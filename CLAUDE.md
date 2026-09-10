# Site Dra. Andressa Chaves Correia

Site com agendamento online sincronizado com Google Calendar.
Plano completo em `docs/` — comece por `docs/DOCUMENTACAO.md`.

## Comandos

```bash
npm run dev              # desenvolvimento
npm run verify           # typecheck + lint + contraste + conformidade + testes
npm run test             # vitest
npm run check:contrast   # contraste WCAG dos tokens
npm run db:generate      # gera migration a partir de lib/db/schema.ts
```

Testes de integração precisam de `DATABASE_URL_TEST`; sem ela, pulam sozinhos.

```bash
# Postgres local para os testes de integração
initdb -D /var/tmp/pg-andressa -U postgres --auth=trust
pg_ctl -D /var/tmp/pg-andressa -o "-p 55432" -l /var/tmp/pg-andressa/log start
createdb -h 127.0.0.1 -p 55432 -U postgres andressa
psql "postgresql://postgres@127.0.0.1:55432/andressa" -f lib/db/migrations/0000_inicial.sql
psql "postgresql://postgres@127.0.0.1:55432/andressa" -f lib/db/migrations/0001_exclusion.sql
export DATABASE_URL_TEST="postgresql://postgres@127.0.0.1:55432/andressa"
```

## Regras invioláveis

1. **Fuso horário só em `lib/datetime.ts`.** Nenhuma aritmética de offset em
   outro lugar. O ESLint bloqueia `getTimezoneOffset()`, `10800000` e
   `new Date(x.getTime() + …)`.
2. **A constraint `appointment_no_overlap` nunca é removida.** É a única
   garantia real contra overbooking. Ver `lib/db/migrations/0001_exclusion.sql`.
3. **Reservar slot passa por `reservarSlot()` + `travarSlot()`** de
   `lib/db/reservas.ts`. Sem o advisory lock a latência sob rajada vai de
   116 ms para 7 s. Ver ADR-004.
4. **`UID` do `.ics` é estável, `SEQUENCE` sempre incrementa.** Sem isso,
   cancelar não remove o evento do iPhone.
5. **Título profissional e CRM vêm de `lib/config.ts`.** Escrever à mão quebra
   o build (`npm run check:conformidade`). A pós-graduação em Nutrologia está
   em curso: o site **não pode** dizer "especialista" sem RQE.
6. **Nenhum hex cru fora de `app/globals.css`.** `npm run check:contrast`
   valida os pares WCAG lendo o CSS real.
7. **Mobile-first.** O uso primário é celular e tablet: projetar em 375 px,
   alvos ≥ 44 px, campos com `font-size` ≥ 16 px (senão o iOS dá zoom).
   Ver `docs/01-MOBILE-FIRST.md`.
8. **Isto não é prontuário.** Sem evolução clínica, exame ou prescrição.

## Estado

| Fase | Situação |
|---|---|
| 01 Design System | tokens, contraste verificado, reset mobile-first |
| 02 Fundação | Next 16, TS estrito, Drizzle, migrations, CI local |
| 04 Motor de disponibilidade | `lib/availability/engine.ts` — completo e testado |
| 06 `.ics` | `lib/calendar/ics.ts` — completo e testado |
| 03, 05, 07–14 | pendentes |
