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

## Achado de implementação — deadlock e latência

> **Atualização de 10/09/2026, medida em Postgres 16 real.** A constraint
> resolve a correção, mas revelou um problema de **latência** que não aparece
> em teste sequencial.

Numa rajada de 20 inserções simultâneas no mesmo slot, as transações formam um
**ciclo de espera** no índice GiST. O Postgres detecta e mata uma delas com
`40P01 deadlock_detected` — mas só depois de esperar o `deadlock_timeout`, que é
de **1 segundo** por padrão.

Medição com `tests/integration/overbooking.test.ts`:

| Implementação | Resultado | Latência do teste |
|---|---|---|
| Só `INSERT` + captura de `23P01` | correto, mas **~15% viram 500** por `40P01` | 7.103 ms |
| `INSERT` + advisory lock por slot | correto, `1 ok / 19 conflito` | **116 ms** |

**61× mais rápido**, e sem nenhum 500.

### A implementação correta

Três camadas, cada uma com um papel:

```ts
// 1. Enfileira os concorrentes do MESMO slot num lock barato,
//    em vez de deixá-los formar ciclo no índice GiST.
await sql.begin(async (tx) => {
  await travarSlot(tx, practitionerId, inicio);   // pg_advisory_xact_lock
  return tx`INSERT INTO appointment ...`;
});
```

```ts
// 2. Traduz os DOIS erros de concorrência em resposta de domínio.
//    23P01 → conflito definitivo.  40P01 → vítima de deadlock, retenta.
export async function reservarSlot<T>(inserir: () => Promise<T>, maxTentativas = 3) {
  for (let tentativa = 0; ; tentativa++) {
    try { return await inserir(); }
    catch (e) {
      const code = codigoPg(e);
      if (code === PG_EXCLUSION_VIOLATION) throw new SlotIndisponivelError();
      if (code === PG_DEADLOCK_DETECTED && tentativa < maxTentativas - 1) {
        await esperar(tentativa); continue;
      }
      if (code === PG_DEADLOCK_DETECTED) throw new SlotIndisponivelError();
      throw e;
    }
  }
}
```

```ts
// 3. A constraint continua sendo a garantia FINAL. O advisory lock é
//    otimização de latência; se alguém esquecer de chamá-lo, o banco
//    ainda impede o overbooking — só que mais devagar.
```

O lock é `xact`: liberado automaticamente no commit ou rollback, sem risco de
vazar. A chave é um FNV-1a de 64 bits de `(practitioner_id, starts_at)`, então
slots diferentes nunca se bloqueiam.

Código em `lib/db/reservas.ts`.

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
