# FASE 02 — Fundação do projeto

> **Objetivo:** repositório, ambiente, banco e CI de pé, com um "hello world"
> tipado indo a produção.
> **Depende de:** nada · **Habilita:** todas as demais
> **Estimativa:** 2 dias

---

## 1. Estrutura de diretórios

```
site-andressa/
├─ app/
│  ├─ (site)/                    # público — RSC, estático
│  │  ├─ layout.tsx
│  │  ├─ page.tsx                # home long-scroll
│  │  ├─ agendar/page.tsx
│  │  ├─ sobre/page.tsx
│  │  ├─ consulta/[token]/page.tsx    # gerir/cancelar (link assinado)
│  │  ├─ politica-de-privacidade/page.tsx
│  │  └─ termos-de-uso/page.tsx
│  ├─ (admin)/admin/             # painel — dinâmico, autenticado
│  │  ├─ layout.tsx
│  │  ├─ page.tsx                # agenda
│  │  ├─ disponibilidade/page.tsx
│  │  └─ integracoes/page.tsx
│  ├─ api/
│  │  ├─ disponibilidade/route.ts
│  │  ├─ agendamentos/route.ts
│  │  ├─ agendamentos/[id]/route.ts
│  │  ├─ calendario/[token]/route.ts       # feed webcal://
│  │  ├─ ics/[id]/route.ts
│  │  ├─ auth/[...nextauth]/route.ts
│  │  ├─ oauth/google/callback/route.ts
│  │  ├─ webhooks/google/route.ts
│  │  └─ cron/{reconciliar,expirar-reservas,renovar-canal}/route.ts
│  ├─ globals.css
│  ├─ sitemap.ts
│  ├─ robots.ts
│  └─ opengraph-image.tsx
├─ components/
│  ├─ ui/                        # design system (FASE-01)
│  ├─ site/                      # Hero, Sobre, Atendimento, FAQ, Rodapé
│  └─ agendamento/               # Stepper, DayPicker, TimeSlotGrid, FormDados
├─ lib/
│  ├─ db/{schema.ts,index.ts,migrations/}
│  ├─ calendar/{google.ts,ics.ts,caldav.ts,freebusy.ts}
│  ├─ availability/{engine.ts,rules.ts}
│  ├─ email/{client.ts,templates/}
│  ├─ crypto.ts                  # AES-256-GCM, hash de token
│  ├─ datetime.ts                # ÚNICO lugar com lógica de fuso
│  ├─ config.ts                  # perfil da médica (fonte única — FASE-10)
│  └─ validation/schemas.ts      # Zod compartilhado cliente/servidor
├─ scripts/{check-contrast.ts,seed.ts}
├─ tests/{unit/,e2e/}
├─ public/
└─ docs/
```

**Regra de ouro:** `lib/datetime.ts` é o **único** arquivo autorizado a converter
fuso horário. Qualquer `new Date()` com aritmética de offset fora dele é bug (lint
custom em FASE-12).

---

## 2. Bootstrap

```bash
npx create-next-app@latest site-andressa \
  --typescript --tailwind --eslint --app --src-dir=false \
  --import-alias "@/*"

cd site-andressa
npm i drizzle-orm postgres zod luxon googleapis resend \
      next-auth@beta @auth/drizzle-adapter motion lucide-react
npm i -D drizzle-kit @types/luxon vitest @vitest/coverage-v8 \
      @playwright/test @axe-core/playwright tsx
npx shadcn@latest init
```

`tsconfig.json` — modo estrito de verdade:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,   // slots[i] vira T | undefined
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true
  }
}
```

`noUncheckedIndexedAccess` importa aqui de verdade: o motor de disponibilidade é
cheio de acesso por índice em arrays de slots, e é exatamente onde um `undefined`
silencioso vira horário fantasma.

---

## 3. Variáveis de ambiente

`.env.example` (versionado; `.env.local` **nunca**):

```bash
# ── Banco ────────────────────────────────────────────────
DATABASE_URL="postgresql://...@...sa-east-1.pooler.supabase.com:6543/postgres"
DATABASE_URL_UNPOOLED="postgresql://...:5432/postgres"   # migrations

# ── Auth (admin) ─────────────────────────────────────────
AUTH_SECRET=""                    # openssl rand -base64 32
AUTH_URL="https://draandressacorreia.com.br"
ADMIN_EMAIL="andressa15correia@gmail.com"   # única conta autorizada

# ── Google Calendar ──────────────────────────────────────
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALENDAR_ID="primary"
GOOGLE_WEBHOOK_TOKEN=""           # segredo do canal push

# ── Criptografia ─────────────────────────────────────────
ENCRYPTION_KEY=""                 # 32 bytes base64 — cifra o refresh token
TOKEN_SALT=""                     # salt do hash de IP e manage_token

# ── E-mail ───────────────────────────────────────────────
RESEND_API_KEY=""
EMAIL_FROM="Dra. Andressa Correia <contato@draandressacorreia.com.br>"
EMAIL_REPLY_TO="andressa15correia@gmail.com"

# ── Cron ─────────────────────────────────────────────────
CRON_SECRET=""

# ── Público ──────────────────────────────────────────────
NEXT_PUBLIC_SITE_URL="https://draandressacorreia.com.br"
NEXT_PUBLIC_WHATSAPP="5511998053826"
NEXT_PUBLIC_PLAUSIBLE_DOMAIN="draandressacorreia.com.br"
```

Validadas na inicialização — falhar cedo, não em produção às 22h:

```ts
// lib/env.ts
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  ADMIN_EMAIL: z.string().email(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  ENCRYPTION_KEY: z.string().length(44),      // 32 bytes em base64
  TOKEN_SALT: z.string().min(16),
  RESEND_API_KEY: z.string().startsWith('re_'),
  CRON_SECRET: z.string().min(16),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
});

export const env = schema.parse(process.env);
```

---

## 4. Banco

Supabase, região **São Paulo (`sa-east-1`)**. Não é exigência legal da LGPD, mas
reduz latência e simplifica o RIPD (FASE-10).

```bash
npx drizzle-kit generate    # gera SQL a partir de lib/db/schema.ts
npx drizzle-kit migrate     # aplica (usa DATABASE_URL_UNPOOLED)
```

Schema completo em [00-ARQUITETURA §6](../00-ARQUITETURA.md#6-modelo-de-dados).

**Migration 0001 deve conter, na ordem:**

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
```

Drizzle não gera `EXCLUDE USING gist` sozinho — a constraint entra numa migration
escrita à mão (`lib/db/migrations/0002_exclusion.sql`) com um comentário explicando
por quê, para que ninguém a remova numa limpeza futura.

`scripts/seed.ts` popula: 1 `practitioner`, 3 `appointment_type` (presencial 40 min,
teleconsulta 30 min, retorno 20 min) e regras de disponibilidade de exemplo.

---

## 5. CI

`.github/workflows/ci.yml`:

| Job | Comando | Bloqueia merge? |
|---|---|---|
| `typecheck` | `tsc --noEmit` | ✅ |
| `lint` | `next lint` | ✅ |
| `contrast` | `tsx scripts/check-contrast.ts` | ✅ |
| `test:unit` | `vitest run --coverage` (mín. 80 % em `lib/availability` e `lib/calendar`) | ✅ |
| `test:e2e` | `playwright test` (Postgres em service container) | ✅ |
| `build` | `next build` | ✅ |
| `lighthouse` | LHCI na preview URL | ⚠️ aviso |

Preview por PR na Vercel; produção só a partir de `main`.

---

## 6. Convenções

- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- **Branches:** `feat/<fase>-<slug>` — ex. `feat/04-motor-disponibilidade`.
- **Idioma:** identificadores e comentários em **português** (é o domínio do
  negócio: `disponibilidade`, `agendamento`, `consulta`); termos técnicos
  consagrados em inglês (`slot`, `token`, `webhook`).
- **Nada de `any`.** `unknown` + narrowing.
- Server Actions só para mutação vinda de formulário; Route Handlers para tudo
  que precisa ser chamado de fora.

---

## 7. Entregáveis

- [ ] Repositório com a estrutura do §1
- [ ] `.env.example` completo e `lib/env.ts` validando
- [ ] Migrations 0001 (tabelas) e 0002 (constraint de exclusão) aplicadas
- [ ] `scripts/seed.ts` funcional
- [ ] CI verde nos 7 jobs
- [ ] Domínio apontado, HTTPS ativo, preview automático por PR

## 8. Critérios de aceite

- [ ] `npm run build` sem erro nem warning de tipo
- [ ] Subir o projeto do zero com `.env.example` preenchido leva < 10 min
- [ ] Tentar inserir dois agendamentos sobrepostos falha com SQLSTATE `23P01`
- [ ] Sem `AUTH_SECRET`, a aplicação **não inicia** (falha explícita, não silenciosa)
