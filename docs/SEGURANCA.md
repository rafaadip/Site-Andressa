# Segurança — auditoria, pentest, SCA e riscos aceitos

> Rodada de 25/09/2026. Cinco frentes, cada uma com evidência reproduzível:
> SAST (leitura do código), fluxos não previstos (corrida, datas absurdas,
> entradas hostis), pentest caixa-cinza contra o build de produção, SCA
> (dependências e licenças) e configuração (misconfiguration).
> **Cada achado corrigido tem teste de regressão que falha sem a correção.**

## 1. Resumo

| ID | Sev. | Achado | Estado | Regressão |
|---|---|---|---|---|
| SEC-01 | Alta | Limites anti-abuso (5/h por IP, 3 futuras por e-mail) contados fora do lock: 12 POSTs simultâneos passavam todos | ✅ Corrigido | `tests/integration/regressao-seguranca.test.ts` |
| SEC-02 | Alta | Reserva anônima sem prova de posse do e-mail nem desafio anti-robô | ⚠️ Mitigado; decisão de produto pendente (§3) | — |
| SEC-03 | Média | Postgres sem TLS por padrão; `sslmode=require` não verifica certificado | ✅ Corrigido (config de produção: §4) | `tests/unit/regressao-seguranca.test.ts` |
| SEC-04 | Média | POST recusado chamava o FreeBusy do Google ao vivo; health sem limite | ✅ Corrigido | integração + unitário |
| SEC-05 | Média | Nome aceitava URL/texto de golpe (e-mail do domínio, `.ics`, agenda da médica) | ✅ Corrigido | unitário |
| SEC-06 | Média (LGPD) | Eliminação, retenção e revogação não chegavam aos eventos do Google | ✅ Corrigido | integração |
| SEC-07 | Baixa | Params de query (nome, motivo) iam ao Sentry dentro do `DrizzleQueryError` | ✅ Corrigido | unitário |
| SEC-08 | Baixa | IPv6 sem agregação /64; `X-Forwarded-For` só é confiável na Vercel | ✅ /64 corrigido; XFF aceito (§3) | unitário |
| SEC-09 | Baixa | `.ics`: CR solto e `CN=` sem aspas | ✅ Corrigido | unitário |
| SEC-10 | Baixa | Sessão do painel sem revogação no servidor | ✅ Corrigido ("Sair" revoga em todo aparelho) | integração |
| SEC-11 | Baixa | Byte NUL → 500; Server Action inválida → evento no Sentry; sem teto | ✅ Corrigido | unitário |
| SEC-12 | Baixa | Token de gestão e e-mail de titular em URL | ⚠️ Aceito (§3) | — |
| SEC-13 | Baixa | `db:seed` com URL de produção apagava a semana real | ✅ Corrigido | unitário |
| SEC-14 | Info | `/api/health` público revelava estado da agenda e falhas | ✅ Corrigido | E2E |
| SEC-15 | Info | Páginas do painel dependiam só do layout para a 2ª checagem | ✅ Corrigido | E2E do painel |
| SEC-16 | Info | Sync aceitava qualquer evento `ag<hex>` para mover consulta | ✅ Corrigido | integração |
| SEC-17 | Info | HTML do paciente na descrição do evento Google | ✅ Corrigido | integração |
| SEC-18 | Info | Limite por e-mail funciona como oráculo | ⚠️ Aceito (§3) | — |
| SEC-19 | Info | Honeypot identificável (422 em `campos.site`) | ⚠️ Aceito (§3) | — |
| SEC-20 | Info | Hardening: URL do site no build, `bloquear` não atômico, painel sem schema, Postgres de dev exposto, `lhci` flutuante, CSP no 404 fora do matcher, `hashIp`, PKCE | ✅ 5 de 8 corrigidos; 3 aceitos (§3) | integração/unitário |
| PT-01 | Baixa | Limite por IP contornável trocando `X-Forwarded-For` (fora da Vercel) | ⚠️ Aceito (= SEC-08) | — |
| PT-02 | Baixa | Limite por e-mail contornável com `+tag`, pontos e `googlemail` | ✅ Corrigido (e-mail canônico) | `tests/integration/regressao-pentest.test.ts` |
| PT-03 | Baixa | Ano 9999 → 500 (timestamp fora da faixa do Postgres) | ✅ Corrigido (alcance de 366 dias) | idem |
| PT-04 | Info | `TRACE` → 500 genérico | ⚠️ Aceito (§3) | E2E (sem eco nem stack) |
| PT-05 | Baixa | Agenda esgotável em massa | ✅ Mitigado (SEC-01 + teto global); ver SEC-02 | integração |

**Pentest:** nenhuma falha Média ou superior no build de produção; 30+ defesas
confirmadas (§6). **SCA:** 0 vulnerabilidades (produção e desenvolvimento).

## 2. Correções — o que mudou

- **SEC-01** (`lib/agendamento/servico.ts`, `lib/db/reservas.ts`): a contagem
  roda de novo **dentro** da transação, depois de `pg_advisory_xact_lock` na
  chave `chaveDosLimites(pid)`. Ordem fixa dos locks: limites → slot (sem
  ciclo). Novo teto global: 30 criações pelo site por hora (log
  `agendamento.limite-global`). Prova: 12 simultâneas → exatamente 3 (e-mail)
  ou 5 (IP).
- **SEC-03** (`lib/db/tls.ts`): host remoto sem `sslmode` cifra (`require`);
  `disable`/`allow`/`prefer` são recusados; com `DATABASE_CA_CERT` o
  certificado é **verificado**. Host local segue a URL.
- **SEC-04**: antes do FreeBusy ao vivo, um filtro de graça (regras, exceções
  e consultas, sem Google) recusa o horário que nunca seria ofertado. A
  contagem por e-mail canônico usa o índice da agenda. `/api/health` em
  cache de 30 s.
- **SEC-05/11** (`lib/validation/agendamento.ts`): nome só com letras (qualquer
  alfabeto, acento), espaço, apóstrofo, ponto e hífen; NFC. Invisíveis
  (controle, zero-width, U+2028/2029) viram espaço no nome e saem do motivo —
  saneados, não recusados: ninguém apaga o que não vê.
- **SEC-06/17** (`lib/calendar/sincronizar.ts`, `lib/agendamento/admin.ts`,
  `lib/lgpd/retencao.ts`): o evento do Google **espelha a linha**. Titular
  eliminado vira evento sem dado pessoal; motivo revogado ou vencido (90 dias)
  sai da descrição, inclusive em consulta passada ou com falta. A
  reconciliação alcança o passado que tem evento a redigir (e nunca cria
  evento para consulta passada). `cancel_reason` sai na eliminação e aos 90
  dias. `include_note_in_event` passa a `false` por padrão (migration 0004).
  Texto do paciente sem `<`/`>` na descrição.
- **SEC-07** (`lib/observabilidade.ts`): erro de banco vai ao Sentry só como
  `postgres <SQLSTATE>`; dos demais, a 1ª linha mascarada; do stack, só os
  quadros `at`. Teto: 5/min por evento, 30/min no total.
- **SEC-08** (`lib/seguranca.ts`): IPv6 agrupado por /64; IPv4 mapeado vira
  IPv4.
- **SEC-09** (`lib/calendar/ics.ts`): controle removido, `\r` solto vira `\n`,
  `CN="…"` entre aspas.
- **SEC-10** (`lib/auth/admin.ts`, migration 0004): `practitioner.
  sessions_valid_after`. "Sair" marca o instante; toda sessão emitida antes
  deixa de valer em qualquer aparelho (inclusive cookie copiado). Páginas,
  ações e `/admin/exportar` conferem no banco (uma leitura por requisição).
- **SEC-11** (`instrumentation.ts`): Server Action inexistente ou de outra
  origem vira aviso local, não evento no Sentry.
- **SEC-13** (`scripts/seed.ts`): horário fictício só em banco local ou com
  `SEED_CONFIRMO_FICTICIO=sim`.
- **SEC-14**: `/api/health` público devolve só `{ status }`; detalhe com
  `Authorization: Bearer $CRON_SECRET`.
- **SEC-15**: todas as `page.tsx` do painel chamam `exigirAdmin()`.
- **SEC-16** (`lib/calendar/receber.ts`): só move consulta pelo evento com
  `extendedProperties.private.appointmentId` igual ao id da consulta.
- **SEC-20**: build de produção falha sem `NEXT_PUBLIC_SITE_URL` `https://`;
  `bloquear()` e a criação pelo site se serializam no mesmo lock (a criação
  confere o bloqueio sob o lock — teste determinístico); `acaoSalvarDia`
  valida as faixas com Zod e `acaoExtra` aceita só um dia com início e fim;
  Postgres do `docker-compose` só em `127.0.0.1`; Lighthouse CI fixado em
  `0.15.1`.

## 3. Riscos aceitos e decisões pendentes

| Item | Por que fica | Mitigação / quando revisitar |
|---|---|---|
| **SEC-02** — confirmação sem prova de posse do e-mail | "Confirmado na hora" é requisito de UX do fluxo (FASE-07). Double opt-in (`held` + link de confirmação) e desafio anti-robô mudam a experiência e exigem decisão da médica | Hoje: SEC-01 (limites sob lock), teto global de 30/h, honeypot, limite por IP/e-mail canônico. **Recomendado antes de divulgar em massa:** regras de WAF da Vercel (§4). Se houver abuso: Cloudflare Turnstile (atualizar CSP e RIPD) ou double opt-in usando `held`/`held_until`, que o schema e a exclusion constraint já cobrem |
| **SEC-08 / PT-01** — `X-Forwarded-For` | Na Vercel o cabeçalho é reescrito pela borda; fora dela o cliente escolhe | **Só a Vercel é suportada.** Com CDN/proxy na frente, rever `ipDaRequisicao()` |
| **SEC-12** — token em `/consulta/<token>` e e-mail em `/admin/privacidade?email=` | O link por e-mail é o mecanismo de gestão sem login; a busca por titular é rara e só no navegador dela | `no-store`, `no-referrer`, `noindex`; a query sai dos nossos logs. Restringir quem acessa os logs da Vercel e manter retenção curta |
| **SEC-18** — oráculo do limite por e-mail | Só confirma algo a quem já sabe o e-mail; a mensagem ajuda o paciente legítimo | Double opt-in (SEC-02) resolve os dois |
| **SEC-19** — honeypot identificável | Responder 201 falso enganaria um humano cujo navegador preenchesse o campo | Revisitar junto com o desafio anti-robô |
| **SEC-20.2** — sem CSP no HTML de 404 de `/api/*` e de arquivos estáticos | O matcher do `proxy.ts` exclui essas rotas de propósito (custo por requisição); o 404 não tem nenhum ponto de injeção | Se um 404 passar a refletir entrada, incluir no matcher |
| **SEC-20.7** — `hashIp` = SHA-256(sal\|ip) | HMAC com a mesma chave não muda o cenário "sal vazado"; o hash expira da relevância em 1 h | Tratado como dado pessoal no RIPD |
| **SEC-20.8** — OAuth sem PKCE | Cliente confidencial (segredo no servidor), `state` de 256 bits | Recomendado pela BCP OAuth 2.1; revisitar numa troca de biblioteca |
| **PT-04** — `TRACE` → 500 | O `Request` do Node (undici) recusa o método antes do `proxy.ts`; não há eco (sem XST) nem stack, e nada vai ao Sentry | Na Vercel a borda responde antes. E2E garante: sem eco, sem stack |
| Majors de ferramental | O `typescript-eslint` do `eslint-config-next` só aceita TypeScript `<6.1` (o 7.0 derrubou o lint e o CI da `main`); os plugins do `eslint-config-next` 16 pedem ESLint `^9` | `typescript` voltou ao 5.9; o Dependabot ignora `typescript >= 6.1` e `eslint >= 10` até o `eslint-config-next` suportar. `@types/node` 26 ficou (só tipos, CI verde) |

## 4. Configuração de produção (checklist)

- **Banco:** URLs com `?sslmode=require`, **Enforce SSL** ligado na Supabase e
  `DATABASE_CA_CERT` preenchido (certificado verificado). Ver `docs/OPERACAO.md §2.1`.
- **WAF da Vercel** (Firewall → Custom Rules), recomendado antes de divulgar:
  - `POST /api/agendamentos`: rate limit de 10/min por IP → 429;
  - `GET /api/disponibilidade`: 60/min por IP;
  - `GET /api/health`: 30/min por IP.
- **Conta Google da médica:** verificação em duas etapas forte (chave de
  segurança ou Proteção Avançada) — o painel é tão seguro quanto essa conta.
- **Segredos:** `AUTH_SECRET` ≥ 32, `TOKEN_SALT` ≥ 16, `CRON_SECRET` ≥ 16,
  `ENCRYPTION_KEY` 32 bytes. Girar `AUTH_SECRET` derruba todas as sessões.
- **`NEXT_PUBLIC_SITE_URL`** `https://` no build (o build falha sem isso).
- **Logs da Vercel:** acesso restrito e retenção curta (SEC-12).

## 5. SCA — dependências e cadeia de fornecimento

- `npm audit`: **0 vulnerabilidades** (produção e desenvolvimento). A única
  cadeia vulnerável (`esbuild` antigo em `@esbuild-kit/core-utils`, dependência
  morta do `drizzle-kit`, só dev) foi resolvida com `overrides`.
- Atualizados (patch/minor, suíte inteira verde): `next` 16.3.6, `react` e
  `react-dom` 19.3.0, `drizzle-orm` 0.45.3, `zod` 4.6.5, `drizzle-kit`
  0.31.11, `vitest` 5.0.2, `tsx` 4.23.15.
- **Licenças de produção** (37 pacotes): MIT, Apache-2.0, ISC, BSD, 0BSD,
  Unlicense, CC-BY-4.0 (dado do `caniuse-lite`) e LGPL-3.0 no `libvips` do
  `sharp` (copyleft fraco, link dinâmico — permitido em software fechado).
  Nenhuma GPL/AGPL, nenhuma licença ausente.
- **CI** (`.github/workflows/ci.yml`): Actions fixadas por SHA
  (`checkout` 7.0.1, `setup-node` 7.0.0, `upload-artifact` 7.0.1 — as v4
  rodavam em Node 20, descontinuado nos runners); `npm audit --omit=dev
  --audit-level=high` bloqueia; auditoria completa informativa; Lighthouse
  CI com versão exata.
- **Dependabot** (`.github/dependabot.yml`): npm e Actions semanais, patch e
  minor agrupados, major individual. **Major só entra com o CI verde no
  próprio PR** — o TypeScript 7 e o ESLint 10 foram mesclados com o CI
  vermelho e quebraram a `main` (revertidos no PR #12). Versões sabidamente incompatíveis ficam em `ignore`, com o motivo.

## 6. Verificado e correto (não reanalisar sem mudança no código)

- **Painel:** o `proxy.ts` resiste a variantes de caminho (`//admin`,
  `/%61dmin`, `/admin;x`, `..`) e a cabeçalhos de bypass
  (`x-middleware-subrequest`, CVE-2025-29927, `x-nextjs-data`, `RSC`). Toda
  Server Action confere a sessão antes de qualquer efeito; POST de outra
  origem é recusado pelo Next. Cookie `__Host-` HMAC em tempo constante.
- **OAuth:** `state` de 256 bits em tempo constante, redirects fixos,
  `id_token` com `aud`/`iss`/`exp`/`email_verified`, escopos exatos, refresh
  token em AES-256-GCM.
- **Anti-overbooking:** advisory lock + exclusion constraint + recheck de
  idempotência + tradução de 23P01/40P01 (ADR-004). Carga: 40 reservas
  simultâneas no mesmo horário → 1 criada, 39 recusadas, 0 sobreposição.
- **Injeção:** só builders do Drizzle ou `sql` parametrizado; React escapa
  tudo; e-mails com `esc()`; CSV neutraliza fórmulas; `.ics` escapado.
- **Cabeçalhos:** CSP com nonce e `strict-dynamic`, `frame-ancestors 'none'`,
  HSTS, COOP, `nosniff`, `Permissions-Policy`, sem `X-Powered-By`.
- **Webhooks e crons:** segredo em tempo constante; sem segredo, fechados.
- **Logs:** só o tipo do erro; PII mascarada; query fora do caminho.

## 7. Como reproduzir

```bash
export DATABASE_URL_TEST=postgresql://postgres@127.0.0.1:55432/andressa
npx vitest run tests/unit/regressao-seguranca.test.ts \
  tests/integration/regressao-seguranca.test.ts tests/integration/regressao-pentest.test.ts
npm run build && npm run test:e2e        # inclui cabeçalhos, CSP, painel, PT-04
npm run test:carga && npm run test:resiliencia
npm audit --omit=dev
```
