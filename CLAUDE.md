# Site Dra. Andressa Chaves Correia

Site com agendamento online sincronizado com Google Calendar.
Plano completo em `docs/` — comece por `docs/DOCUMENTACAO.md`.

## Comandos

```bash
npm run dev              # desenvolvimento
npm run verify           # typecheck + lint + contraste + conformidade + testes
npm run test             # vitest (unitários + integração)
npm run test:e2e         # Playwright contra o build de produção (rode `npm run build` antes)
npm run check:contrast   # contraste WCAG dos tokens
npm run db:generate      # gera migration a partir de lib/db/schema.ts
```

Testes de integração e E2E de agendamento precisam de `DATABASE_URL_TEST`;
sem ela, pulam sozinhos. O setup migra e semeia o banco de teste sozinho.

```bash
# Postgres local (uma vez)
initdb -D /var/tmp/pg-andressa -U postgres --auth=trust
pg_ctl -D /var/tmp/pg-andressa -o "-p 55432" -l /var/tmp/pg-andressa/log start
createdb -h 127.0.0.1 -p 55432 -U postgres andressa

export DATABASE_URL="postgresql://postgres@127.0.0.1:55432/andressa"
npm run db:migrate       # SEMPRE pelo journal — nunca `psql -f` numa migration
npm run db:seed          # horários FICTÍCIOS de desenvolvimento
export DATABASE_URL_TEST="$DATABASE_URL"
```

Rodar o site local: copie `.env.example` para `.env.local` e preencha
`DATABASE_URL`, `TOKEN_SALT`, `NEXT_PUBLIC_SITE_URL` e
`AGENDAMENTO_SEM_GOOGLE=aceito`.

## Regras invioláveis

1. **Fuso horário só em `lib/datetime.ts`.** Nenhuma aritmética de offset em
   outro lugar. O ESLint bloqueia `getTimezoneOffset()`, `10800000` e
   `new Date(x.getTime() + …)`.
2. **A constraint `appointment_no_overlap` nunca é removida.** É a única
   garantia real contra overbooking. Ver `lib/db/migrations/0001_exclusion.sql`.
   Migration nova vai pelo `drizzle-kit generate` (ou `--custom`), para entrar
   no journal: `.sql` fora do journal NÃO roda no deploy. `npm run db:migrate`
   falha se a constraint não existir depois de migrar.
3. **Criar agendamento passa por `criarAgendamento()`** de
   `lib/agendamento/servico.ts`: advisory lock, recheck de idempotência depois
   do lock, e `reservarSlot()` traduzindo 23P01/40P01. Ver ADR-004.
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
9. **CSS próprio sempre dentro de `@layer base` ou `@layer components`.** No
   Tailwind v4, CSS fora de camada vence os utilitários — um reset solto
   chegou a apagar todos os `mt-*`/`pt-*` do site.
10. **Texto do site em `lib/content/site.ts`**, não no JSX. Passa pelo
    `check:conformidade`. O texto só promete o que o sistema já faz (ex.:
    nada de "você recebe um e-mail" antes da FASE-08).
11. **Sem Google Calendar, produção só oferta horários com
    `AGENDAMENTO_SEM_GOOGLE=aceito`.** Sem ele o site não sabe dos plantões
    da médica; sem o opt-in, `/agendar` cai no WhatsApp.

## Estado

| Fase | Situação |
|---|---|
| 01 Design System | tokens, contraste verificado, reset mobile-first, CSS em `@layer` |
| 02 Fundação | Next 16, TS estrito, Drizzle, migrations, CI local |
| 04 Motor de disponibilidade | `lib/availability/engine.ts` — completo e testado |
| 06 `.ics` | `lib/calendar/ics.ts` — completo e testado |
| 03 Site institucional | home, /sobre, /agendar (provisória), privacidade, termos, sitemap, JSON-LD — 49 testes E2E |
| 07 Fluxo de agendamento | 4 etapas, API, gestão/cancelamento por link, `.ics` — 25 testes de integração + 10 E2E |
| 05, 08–14 | pendentes |
