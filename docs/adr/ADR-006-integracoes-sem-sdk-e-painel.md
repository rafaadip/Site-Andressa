# ADR-006 — Integrações sem SDK, sessão própria no painel e CSP com nonce

- **Status:** Aceita
- **Data:** 2026-09-25
- **Substitui em parte:** a tabela de stack do [00-ARQUITETURA §5](../00-ARQUITETURA.md)
  (Auth.js v5, React Email, `googleapis`, SDK do Sentry, shadcn/ui, Motion)

## Contexto

Na implementação das FASES 05, 08, 09 e 13, quatro escolhas do plano original
foram confrontadas com o código real (Next.js **16**, React 19, deploy
serverless) e com o critério de "um desenvolvedor consegue operar" (RNF-07).

## Decisões

### 1. Google, Resend e Sentry por `fetch`, sem SDK

| Plano | Implementado | Por quê |
|---|---|---|
| `googleapis` | `lib/calendar/google.ts` (~250 linhas) | O pacote tem ~100 MB e centenas de APIs; usamos 6 endpoints. Cada chamada fica explícita, tipada só no que lemos e trivial de simular nos testes (um Google Calendar falso em memória: `tests/setup/servicos-falsos.ts`) |
| Resend SDK + React Email | `lib/email/cliente.ts` + `lib/email/layout.ts` | E-mail transacional sóbrio cabe num modelo de blocos que gera HTML (tabela, CSS inline) **e** texto puro da mesma fonte — a versão texto não fica para trás |
| `@sentry/nextjs` | `lib/observabilidade.ts` (envelope HTTP) | O SDK instrumenta o build inteiro e captura corpo de requisição por padrão; aqui só sai o que mandamos, depois de `lib/pii.ts` |

**Custo aceito:** acompanhar mudanças dessas APIs à mão (revisão trimestral —
[FASE-14 §6](../fases/FASE-14-roadmap.md)).

### 2. Sessão própria no painel em vez de Auth.js v5

O painel tem **um** usuário, sem cadastro nem recuperação de senha. O Auth.js v5
ainda é beta e acoplado a versões do Next. O que precisamos cabe em
`lib/auth/sessao.ts`: login OAuth do Google (`openid email`), conferência de
`aud`/`iss`/`email_verified` e da allowlist, e um cookie `payload.HMAC` com
30 dias. Três portas na leitura: assinatura em tempo constante, validade e
e-mail ainda igual ao `ADMIN_EMAIL` (trocar a variável derruba sessões).

O login e a conexão da agenda são **consentimentos separados**: o do login
(`openid email`) é descartado logo após confirmar a identidade; o da agenda
pede exatamente os dois escopos da FASE-05, sem `include_granted_scopes`.

### 3. CSP com nonce por requisição ⇒ páginas dinâmicas

A [FASE-13 §3](../fases/FASE-13-deploy-observabilidade.md) pede CSP sem
`unsafe-inline` em script. No Next, isso exige nonce por requisição
(`proxy.ts`), e nonce exige renderização dinâmica — sem pré-render estático.

**Medido:** Lighthouse mobile (4G simulado) segue com Acessibilidade, SEO e
Boas práticas em 100 e Performance 92–93; o TTFB observado fica em dezenas de
milissegundos (páginas leves, função na mesma região do banco — `gru1`). O
ganho de segurança vale o custo. Se um dia o custo aparecer, a alternativa é o
SRI experimental do Next.

### 4. Sem shadcn/ui nem Motion

Os poucos componentes interativos (grupos de rádio com setas, menu com foco
preso, confirmação inline) foram escritos à mão, com teclado e ARIA testados
por E2E + axe. As transições são CSS (`transform`/`opacity`) e respeitam
`prefers-reduced-motion`. Menos JavaScript no celular, que é o uso primário.

## Consequências

- Nenhuma dependência de runtime além de Next, React, Drizzle, `postgres`,
  Luxon, Zod, lucide e `sharp` (usado só no build da imagem OpenGraph).
- Os testes de integração usam serviços falsos que seguem a documentação
  pública das APIs; o **teste manual com a agenda real** continua obrigatório
  antes do go-live ([OPERACAO §5](../OPERACAO.md)).
- `fetch` com timeout em toda chamada externa: falha vira erro tipado e
  transitório, nunca requisição pendurada.
