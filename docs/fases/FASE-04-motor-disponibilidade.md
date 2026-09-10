# FASE 04 — Motor de disponibilidade

> **Objetivo:** dada uma modalidade e um intervalo de datas, devolver exatamente os
> horários que a médica pode atender — corretos em fuso, sem sobreposição e rápidos.
> **Depende de:** FASE-02 · **Habilita:** FASE-05, FASE-07
> **Estimativa:** 4 dias — **é o núcleo do sistema**

---

## 1. Por que esta fase é a mais delicada

Erros aqui não aparecem em teste: aparecem como uma paciente parada na porta de um
consultório vazio. E são silenciosos — nenhum log, nenhuma exceção, só um horário
que não deveria existir.

As quatro fontes de erro, em ordem de frequência:

1. **Fuso horário.** Somar offset à mão em vez de usar base IANA.
2. **Buffers.** Esquecer que uma consulta de 40 min com 10 min de intervalo ocupa
   50 min de agenda.
3. **Condição de corrida.** Dois pacientes, um horário (resolvido no banco — ADR-004).
4. **Limite de janela.** Ofertar um slot de 40 min que começa 20 min antes do fim do
   expediente.

---

## 2. O pipeline

```
entrada: { tipo, de, ate, timezone = 'America/Sao_Paulo' }

 ┌─ 1. EXPANDIR ────────────────────────────────────────────
 │  availability_rule (weekday, start_time, end_time em hora LOCAL)
 │  → para cada data do intervalo, materializa o intervalo local
 │  → converte para UTC APENAS AGORA, via IANA
 │
 ├─ 2. EXCEÇÕES ────────────────────────────────────────────
 │  kind='block' → subtrai (férias, congresso, plantão)
 │  kind='extra' → adiciona (mutirão de sábado)
 │
 ├─ 3. AGENDA PESSOAL ──────────────────────────────────────
 │  Google FreeBusy (cache 60 s) → subtrai compromissos
 │  ⚠️ ignora eventos 'transparent' (marcados como "livre")
 │
 ├─ 4. JÁ AGENDADO ─────────────────────────────────────────
 │  appointment status IN ('held','confirmed') → subtrai
 │  (já inclui os buffers no intervalo persistido)
 │
 ├─ 5. FATIAR ──────────────────────────────────────────────
 │  passo = duration_min (+ buffers)
 │  alinhado à grade de 5 min a partir do início da janela
 │  descarta slot cujo FIM ultrapasse a janela
 │
 ├─ 6. POLÍTICAS ───────────────────────────────────────────
 │  lead time    : início ≥ agora + 12 h
 │  horizonte    : início ≤ agora + 60 dias
 │  máx./dia     : opcional, teto por dia
 │
 └─ saída: { timezone, geradoEm, dias: [{ data, slots: [...] }] }
```

---

## 3. Fuso horário — o contrato

`lib/datetime.ts` é o **único** módulo autorizado a converter fuso. Todo o resto
trabalha com `Date` em UTC ou com `DateTime` da Luxon já zoneado.

```ts
import { DateTime, Interval } from 'luxon';

export const TZ_CLINICA = 'America/Sao_Paulo';

/** "toda terça às 14:00 local" → instante UTC daquela terça específica. */
export function horaLocalParaUtc(
  data: string,        // '2026-09-15'
  hora: string,        // '14:00'
  zona = TZ_CLINICA,
): Date {
  const dt = DateTime.fromISO(`${data}T${hora}`, { zone: zona });
  if (!dt.isValid) throw new Error(`Data/hora inválida: ${data}T${hora} @ ${zona}`);
  return dt.toUTC().toJSDate();
}

/** Rótulo para exibição, sempre no fuso da clínica. */
export function formatarParaPaciente(instante: Date, zona = TZ_CLINICA): string {
  return DateTime.fromJSDate(instante).setZone(zona)
    .toFormat("cccc, d 'de' LLLL 'às' HH:mm", { locale: 'pt-BR' });
}
```

**Proibido em todo o restante do código:**

```ts
new Date(dt.getTime() + 3 * 3600000)   // ❌ offset fixo
dt.getTimezoneOffset()                 // ❌ fuso do servidor, não da clínica
new Date('2026-09-15 14:00')           // ❌ parsing dependente de runtime
```

Regra reforçada por ESLint custom (`no-restricted-syntax`) em FASE-12.

### 3.1 Por que hora local em `availability_rule`

"Atendo às terças, 14h–18h" é uma afirmação sobre o **relógio da parede**. Se o
Brasil reintroduzir horário de verão, ela continua atendendo às 14h — e o instante
UTC correspondente é que muda. Guardar UTC congelaria o erro em todas as regras.

Convertemos para UTC só no passo 1, com os dados de fuso do momento da consulta.

---

## 4. Aritmética de intervalos

Toda subtração usa `Interval` da Luxon, que já trata bordas corretamente:

```ts
// lib/availability/engine.ts
function subtrair(janelas: Interval[], ocupados: Interval[]): Interval[] {
  return janelas.flatMap(j => Interval.xor([j, ...ocupados])
    .filter(r => j.engulfs(r)));
}
```

Casos de borda que **precisam** de teste (FASE-12):

| Caso | Esperado |
|---|---|
| Ocupado idêntico à janela | janela some |
| Ocupado engloba a janela | janela some |
| Ocupado no meio | duas janelas |
| Ocupado encosta no início (`ends_at == start`) | janela intacta — encostar não é sobrepor |
| Ocupado de duração zero | ignorado |
| Ocupados sobrepostos entre si | normaliza antes de subtrair |

---

## 5. Buffers

```
Consulta presencial: duration_min=40, buffer_before=0, buffer_after=10

Grade real:  14:00 ──consulta 40min── 14:40 ─buffer 10─ 14:50
Próximo slot: 14:50

O appointment persistido guarda starts_at=14:00, ends_at=14:50
  → é o intervalo BLOQUEADO (o que a constraint de exclusão protege)
  → o horário CLÍNICO (14:00–14:40) é derivado na exibição
```

Documentado assim para que ninguém "corrija" mais tarde achando que há um bug de
10 minutos.

---

## 6. Contrato da API

```http
GET /api/disponibilidade?tipo=consulta-presencial&de=2026-09-14&ate=2026-09-27
```

```jsonc
{
  "timezone": "America/Sao_Paulo",
  "geradoEm": "2026-09-10T18:22:04.512Z",
  "tipo": { "slug": "consulta-presencial", "duracaoMin": 40,
            "modalidade": "in_person" },
  "dias": [
    { "data": "2026-09-15", "diaSemana": "seg",
      "slots": [
        { "inicio": "2026-09-15T17:00:00.000Z", "rotulo": "14:00" },
        { "inicio": "2026-09-15T17:50:00.000Z", "rotulo": "14:50" }
      ] },
    { "data": "2026-09-16", "diaSemana": "ter", "slots": [] }
  ],
  "degradado": false   // true quando o FreeBusy falhou e servimos cache
}
```

**Decisões do contrato:**

- `inicio` em **ISO 8601 UTC**; `rotulo` já formatado no fuso da clínica. O cliente
  não faz conta de fuso — reduz a superfície de erro a um lugar.
- Dias sem vaga vêm com `slots: []` em vez de sumirem: o calendário mostra o dia
  desabilitado, o que é informação (*"terça ela não atende"*), não ausência.
- `degradado: true` faz a interface exibir um aviso discreto (ADR-002).

### Cache

```ts
headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
```

Invalidação por tag (`revalidateTag('disponibilidade')`) em: webhook do Google,
criação/cancelamento de agendamento, alteração de regra ou exceção.

---

## 7. Desempenho

| Operação | Alvo |
|---|---|
| Cache quente | < 50 ms |
| Cache frio (com FreeBusy) | < 400 ms |
| Chamadas ao FreeBusy | 1 por janela, **nunca** 1 por dia |

Uma única chamada `freebusy.query` cobre o intervalo inteiro. Consultar dia a dia é
o erro que estoura a cota do Google e deixa o seletor lento.

---

## 8. Entregáveis

- [ ] `lib/datetime.ts` — conversões, com todas as outras proibidas por lint
- [ ] `lib/availability/rules.ts` — expansão de regras e exceções
- [ ] `lib/availability/engine.ts` — pipeline dos 6 passos, função pura e testável
- [ ] `lib/calendar/freebusy.ts` — cliente com cache e degradação
- [ ] `app/api/disponibilidade/route.ts`
- [ ] Suíte de testes com ≥ 90 % de cobertura no motor

## 9. Critérios de aceite

- [ ] Todos os casos de borda do §4 cobertos por teste
- [ ] Teste de fuso: com `TZ=UTC`, `TZ=America/Sao_Paulo` e `TZ=Asia/Tokyo` no
      processo, a saída é **idêntica** (o fuso do servidor não pode influenciar nada)
- [ ] Teste de regressão de horário de verão: com uma zona que *tem* DST
      (`America/New_York`), a transição não gera slot duplicado nem buraco
- [ ] Nenhum slot ofertado ultrapassa o fim da janela
- [ ] Slot que encosta no fim de um ocupado (sem sobrepor) **é** ofertado
- [ ] FreeBusy fora do ar → resposta `degradado: true`, não erro 500
- [ ] Uma chamada de FreeBusy por requisição, comprovada por teste com mock
