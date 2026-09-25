# Site Dra. Andressa Chaves Correia

Site com agendamento online sincronizado com Google Calendar, e-mails e
painel da médica. Plano completo em `docs/` — comece por `docs/DOCUMENTACAO.md`.
Colocar no ar e operar: `docs/OPERACAO.md`.

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
Google e Resend são simulados em memória (`tests/setup/servicos-falsos.ts`);
o E2E do painel assina a sessão com o `AUTH_SECRET` de teste.

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
    "você recebe um e-mail" só onde a Resend estiver garantidamente
    configurada — a tela de confirmação não depende disso).
11. **Sem Google Calendar, produção só oferta horários com
    `AGENDAMENTO_SEM_GOOGLE=aceito`.** Sem ele o site não sabe dos plantões
    da médica; sem o opt-in, `/agendar` cai no WhatsApp. Agenda que FOI
    conectada e caiu degrada para D+2 (ADR-002) e o painel alerta.
12. **Efeito externo (Google, e-mail) nunca dentro da requisição.** O fato e a
    notificação são gravados na MESMA transação (`enfileirar()`); o envio vem
    depois (`after(() => efeitosDe(id))`) e o cron reprocessa. Falha de
    integração nunca perde consulta.
13. **Nada de script inline sem nonce.** A CSP (`lib/csp.ts`, via `proxy.ts`)
    bloqueia; por isso as páginas são dinâmicas (ADR-006).
14. **Número de política no texto vem do banco.** Antecedência, horizonte e
    prazo de cancelamento são editáveis no painel: texto público com "24
    horas" escrito à mão vira promessa falsa (`prazoCancelamentoPublico()`).
15. **`position: fixed` nunca dentro de elemento com `backdrop-filter`.** Ele
    vira o bloco de contenção — foi assim que o menu do celular abriu com
    altura zero.
16. **PII nunca em log.** Use `log` de `lib/log.ts` (filtra por chave e por
    padrão); nunca `console.log` de objeto de paciente.

## Estado

Todas as fases de código (01–13) implementadas; 14 é roadmap. Testes:
211 unitários + integração, 80 E2E, Lighthouse CI no pipeline.

| Fase | Onde |
|---|---|
| 01 Design System | `app/globals.css`, `lib/marca.ts` (espelho conferido) |
| 02 Fundação | Next 16, TS estrito, Drizzle, migrations pelo journal, CI no GitHub Actions |
| 03 Site institucional | home, /sobre, /agendar, privacidade, termos, sitemap, JSON-LD, OG |
| 04 Motor | `lib/availability/engine.ts` |
| 05 Google Calendar | `lib/calendar/{google,conexao,freebusy,sincronizar,receber,canal}.ts` |
| 06 `.ics` | `lib/calendar/ics.ts` |
| 07 Fluxo | `components/agendamento/*`, `lib/agendamento/servico.ts` |
| 08 E-mails | `lib/email/*`, `lib/notificacoes/*` (outbox + lembretes) |
| 09 Painel | `app/admin/*`, `lib/agendamento/admin.ts`, `lib/auth/*`, `proxy.ts` |
| 10 LGPD/CFM | `lib/lgpd/retencao.ts`, painel → Privacidade, `docs/RIPD.md` |
| 11 SEO/perf | `app/opengraph-image.tsx`, `lib/fonts.ts`, `docs/GUIA-PERFIL-EMPRESA-GOOGLE.md` |
| 12 QA | `tests/` (unit, integration, e2e com axe e matriz de viewports) |
| 13 Deploy | `vercel.json`, `/api/health`, `instrumentation.ts`, `.github/workflows/ci.yml` |

Pendências que NÃO são de código (ver `docs/DOCUMENTACAO.md` §9): endereço
do consultório, horários reais, domínio, DNS do e-mail, revisão jurídica e
testes manuais em aparelho real.
