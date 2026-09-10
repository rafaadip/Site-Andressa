# ADR-004 — Anti-overbooking com `EXCLUDE USING gist`

- **Status:** Aceita
- **Data:** 2026-09-10

## Contexto

Dois pacientes abrem o site ao mesmo tempo — cenário real quando a médica posta o
link no Instagram — e escolhem o mesmo horário. A sequência ingênua:

```sql
SELECT 1 FROM appointment WHERE starts_at = $1 AND status = 'confirmed';
-- não achou nada nas DUAS requisições, porque rodaram em paralelo
INSERT INTO appointment (...);  -- as DUAS inserem
```

Resultado: dois pacientes, um horário. Em ambiente serverless (Vercel), com
múltiplas instâncias concorrentes e nenhuma memória compartilhada, um lock em
processo Node não ajuda.

## Opções

### A. Verificar na aplicação antes de inserir
Race condition (acima). ❌

### B. Lock distribuído (Redis / `SETNX`)
- ➕ Funciona.
- ➖ Mais um serviço para operar, monitorar e pagar.
- ➖ Falha aberta: se o Redis cair, o overbooking volta.

### C. `SERIALIZABLE` no PostgreSQL
- ➕ Correto.
- ➖ Custo de retry em toda a aplicação; força tratar `40001` em qualquer transação.

### D. Constraint de exclusão no PostgreSQL
```sql
CREATE EXTENSION btree_gist;
ALTER TABLE appointment ADD CONSTRAINT appointment_no_overlap
  EXCLUDE USING gist (
    practitioner_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status IN ('held','confirmed'));
```
- ➕ O **banco** garante a invariante. Nenhum caminho de código consegue violá-la —
  nem um script manual, nem um bug futuro, nem uma migração mal feita.
- ➕ Cobre **sobreposição**, não só igualdade: uma consulta de 40 min às 14:00
  bloqueia a de 30 min às 14:20. Um `UNIQUE(starts_at)` não faria isso.
- ➕ Zero infraestrutura adicional.
- ➖ Amarra ao PostgreSQL (aceitável — já é a escolha).
- ➖ Exige tratar o SQLSTATE `23P01` na aplicação.

## Decisão

**Opção D.**

A cláusula `WHERE (status IN ('held','confirmed'))` é essencial: agendamentos
`cancelled` precisam **poder** sobrepor, senão um cancelamento bloquearia o horário
para sempre.

O `practitioner_id WITH =` (que exige a extensão `btree_gist` para indexar um `uuid`
num índice GiST) deixa o modelo pronto para mais de um profissional sem migração.

## Implementação

```ts
import { DatabaseError } from 'pg';

const PG_EXCLUSION_VIOLATION = '23P01';

try {
  await db.insert(appointment).values({ ...dados, status: 'held' });
} catch (e) {
  if (e instanceof DatabaseError && e.code === PG_EXCLUSION_VIOLATION) {
    return Response.json(
      { erro: 'SLOT_INDISPONIVEL',
        mensagem: 'Este horário acabou de ser reservado. Escolha outro.' },
      { status: 409 },
    );
  }
  throw e;
}
```

No cliente, o 409 **não** é um erro genérico: recarrega os slots do dia, destaca o
horário perdido e desliza o foco para a nova seleção. Um 409 bem tratado é
indistinguível de UX normal.

## Consequências

- Buffers (`buffer_before_min` / `buffer_after_min`) entram em `starts_at`/`ends_at`
  no momento da inserção — o intervalo persistido é o **bloqueado**, não o
  clínico. Guardar os dois separadamente é possível, mas complica a constraint;
  para o MVP, o intervalo bloqueado basta, com o horário clínico derivado na
  exibição.
- Reservas `held` expiram por `held_until`. Um cron a cada 2 min faz
  `UPDATE ... SET status='expired' WHERE status='held' AND held_until < now()`,
  liberando o horário.
- Teste obrigatório em FASE-12: disparar 20 POSTs concorrentes no mesmo slot e
  afirmar que exatamente **um** retorna 201.
