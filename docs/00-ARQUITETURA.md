# Arquitetura — Site Dra. Andressa Chaves Correia

> Documento-raiz. Define o problema, as restrições, a decomposição do sistema e as
> decisões estruturais. Todas as fases em `docs/fases/` derivam deste documento.

---

## 1. Contexto

Site profissional de médica com **agendamento online** e **sincronização com o
Google Agenda**, entregando o compromisso ao paciente em qualquer calendário
(Apple, Google, Outlook) via `.ics`. Escala: **1 profissional**, dois locais de
atendimento (consultório em Guarulhos–SP e teleconsulta), volume estimado de 5–40
agendamentos/semana.

**Uso primário: celular e tablet** — o desktop é o caso derivado
([01-MOBILE-FIRST](01-MOBILE-FIRST.md)).

### 1.1 Perfil (extraído do currículo)

| Campo | Valor |
|---|---|
| Nome | Andressa Chaves Correia |
| Registro | CRM-SP 267.777 |
| Graduação | Medicina — UNINOVE (2019–2024) |
| Pós-graduação | Lato Sensu em **Nutrologia** — Afya (fev/2026 – jul/2027, **em curso**) |
| Certificação | ACLS — *Advanced Cardiovascular Life Support* |
| Atuação | Hapvida · UPA Taboão (Guarulhos) · Complexo Hospitalar Padre Bento · Hospital Keila Ferreira |
| Internato | Santa Casa de Misericórdia de SP · Hospital Geral de Guarulhos |
| Competências | Urgência e emergência, medicina interna, evoluções e prescrições, análise de ECG, intubação orotraqueal |
| Acadêmico | Diretoria da Liga de Alergia e Imunologia (2021–2023) · Financeiro do CA Rebeca Boltes Cecatto (2022–2023) |
| Contato | (11) 99805-3826 · andressa15correia@gmail.com · Guarulhos–SP |

### 1.2 Alerta de conformidade que molda o produto

A pós-graduação em Nutrologia **está em curso** (conclusão prevista jul/2027). Enquanto
não houver **RQE registrado no CRM**, o site **não pode** anunciar "Especialista em
Nutrologia" — o material de redes sociais fornecido usa essa expressão e precisa ser
revisto.

**Redação adotada no site até a obtenção do RQE:**

> ✅ "Médica · CRM-SP 267.777 — com atuação em Nutrologia"
> ✅ "Pós-graduanda em Nutrologia (Afya)"
> ❌ "Especialista em Nutrologia" · ❌ "Nutróloga" · ❌ qualquer sigla RQE

Isso não é detalhe de copy: é um campo de configuração (`PROFESSIONAL_TITLE`) que
aparece em ~12 lugares (header, hero, footer, `.ics`, e-mails, JSON-LD, `<title>`,
OpenGraph). Centralizar agora evita uma caça a strings em 2027. Ver
[FASE-10](fases/FASE-10-compliance-lgpd-cfm.md).

---

## 2. Requisitos

### 2.1 Funcionais

| # | Requisito | Prioridade |
|---|---|---|
| RF-01 | Apresentar perfil, formação e modalidades de atendimento | MVP |
| RF-02 | Paciente escolhe modalidade → data → horário → dados → confirma | MVP |
| RF-03 | Slots ofertados refletem a agenda **real** da médica (sem overbooking) | MVP |
| RF-04 | Consulta confirmada aparece automaticamente no Google Agenda da médica | MVP |
| RF-05 | Paciente recebe o compromisso em **qualquer** calendário (Apple/Google/Outlook) | MVP |
| RF-06 | E-mail de confirmação com `.ics` anexado | MVP |
| RF-07 | Painel administrativo: ver agenda, definir disponibilidade, bloquear datas | MVP |
| RF-08 | Cancelamento/remarcação por link seguro (sem login) | MVP |
| ~~RF-09~~ | ~~Sincronização com Apple Calendar da médica~~ | ❌ **removido do escopo** em 10/09/2026 |
| RF-10 | Lembretes automáticos (WhatsApp/e-mail) em D-1 e H-2 | v1.1 |

### 2.2 Não-funcionais

| # | Requisito | Alvo |
|---|---|---|
| RNF-01 | Performance | LCP ≤ 2,0 s · INP ≤ 200 ms · CLS ≤ 0,05 (4G, mobile mediano) |
| RNF-02 | Acessibilidade | WCAG 2.2 nível AA, verificado |
| RNF-02b | **Mobile-first** | **Uso primário é celular e tablet.** Projetado em 375 px; alvos ≥ 44 px; testado em aparelho real. Ver [01-MOBILE-FIRST](01-MOBILE-FIRST.md) |
| RNF-03 | Disponibilidade | 99,5 % · degradação graciosa: se o Calendar cair, o agendamento continua (fila) |
| RNF-04 | Privacidade | LGPD — minimização, consentimento destacado para dado de saúde |
| RNF-05 | Publicidade médica | Resoluções CFM vigentes |
| RNF-06 | Custo operacional | ≤ R$ 120/mês em regime normal |
| RNF-07 | Manutenção | um único desenvolvedor deve conseguir operar |

### 2.3 Não-objetivos (escopo explicitamente fora)

Marcar isto é uma decisão de arquitetura, não uma omissão:

- ❌ **Prontuário eletrônico.** Guardar evolução clínica submeteria o sistema à
  Resolução CFM nº 1.821/2007 e à certificação SBIS-CFM. O sistema guarda apenas o
  necessário para **marcar um horário**.
- ❌ **Pagamento online.** Regras de publicidade médica restringem divulgação de
  preços/promoções; e cobrar antecipadamente cria obrigação de estorno. Cobrança
  ocorre presencialmente.
- ❌ **Upload de exames.** Dado sensível em volume, sem valor para o MVP.
- ❌ **Login de paciente.** Cada conta é superfície de ataque e fricção. Ações
  pós-agendamento usam link assinado de uso único.
- ❌ **Multi-profissional / multi-clínica.** Modelado no banco (`practitioner_id`),
  mas sem UI.
- ❌ **Sincronização da agenda da médica com a Apple.** Removida a pedido do cliente
  em 10/09/2026: a agenda dela é exclusivamente Google Calendar. O `.ics` continua
  para o **paciente**, por ser formato universal e não integração Apple
  ([ADR-003](adr/ADR-003-ics-para-o-paciente.md)).

---

## 3. A decisão central: o que "sincronizar com Google e Apple" realmente significa

A maior parte da complexidade deste projeto está aqui, e o erro clássico é tratar
como **um** problema o que na verdade são **dois**, com requisitos opostos.

### Problema A — calendário da **médica**

Precisa ser **bidirecional e contínuo**:

- **ler** compromissos pessoais para nunca ofertar um horário ocupado;
- **escrever** a consulta confirmada;
- **reagir** quando ela mover/apagar algo direto no celular.

### Problema B — calendário do **paciente**

Precisa apenas ser **unidirecional e pontual**: o evento entra no telefone dele
**uma vez**. Ele não vai autorizar OAuth para marcar uma consulta.

### Por que isso importa

Apple **não oferece API pública de calendário**. Não existe "Login com Apple para
Calendar". Quem tenta resolver o Problema B com API bate nesse muro e conclui,
erradamente, que "não dá para entregar a consulta no iPhone".

Dá — pela porta certa, e sem API nenhuma:

| | Médica (Problema A) | Paciente (Problema B) |
|---|---|---|
| **Google** | Calendar API v3 + OAuth 2.0 (`offline`, refresh token) + canal push | Link `render?action=TEMPLATE` |
| **Apple** | ❌ **fora de escopo** — agenda dela é só Google | Arquivo `.ics` (RFC 5545) |
| **Outlook** | — | `.ics` |
| Direção | ↔ contínua | → uma vez |
| Autenticação | Uma vez, no `/admin` | **Nenhuma** |

O `.ics` é um padrão aberto (RFC 5545) que Apple Calendar, Google, Outlook, Samsung
Calendar e Thunderbird abrem nativamente. **É a resposta correta para o lado do
paciente — não um paliativo.** Entregue como anexo do e-mail de confirmação, o iOS
oferece "Adicionar ao Calendário" direto no Mail, sem download.

Do lado da médica, o Google é a **única** integração de agenda — decisão do cliente
em 10/09/2026, que removeu do escopo o feed `webcal://` e o CalDAV no iCloud. Isso
torna o Google um ponto único de falha, e a degradação graciosa descrita em
[ADR-002](adr/ADR-002-google-fonte-da-verdade.md) deixa de ser precaução e vira
requisito. Detalhes em [ADR-003](adr/ADR-003-ics-para-o-paciente.md).

---

## 4. Visão de contexto

```
                        ┌───────────────────────────────┐
   Paciente  ─────────► │   Next.js (Vercel)            │
   (browser)            │   ┌─────────────────────────┐ │
                        │   │ RSC — páginas estáticas │ │
                        │   ├─────────────────────────┤ │
                        │   │ Route Handlers — /api   │ │
                        │   └─────────────────────────┘ │
                        └───┬───────────┬───────────┬───┘
                            │           │           │
                  ┌─────────▼──┐  ┌─────▼─────┐  ┌──▼──────────┐
                  │ PostgreSQL │  │  Resend   │  │  Google     │
                  │ (Supabase) │  │  (e-mail  │  │  Calendar   │
                  │            │  │   + .ics) │  │  API v3     │
                  │ appointment│  └─────┬─────┘  └──┬───────┬──┘
                  │ availability│       │           │       │
                  │ oauth_token │       │           │  push │
                  │ audit_log   │       ▼           ▼       │webhook
                  └────────────┘   Paciente     Agenda da   │
                                   (inbox +     médica      │
                                    .ics)                   │
                        ┌───────────────────────────────────┘
                        ▼
              ┌──────────────────┐
              │ /admin (médica)  │
              │ Auth.js + Google │
              └──────────────────┘
```

---

## 5. Stack

| Camada | Escolha | Por quê (resumo — detalhes nos ADRs) |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Um runtime só para site estático + API. RSC entrega HTML puro nas páginas de marketing (SEO local importa) e Route Handlers cuidam de OAuth/DB. [ADR-001](adr/ADR-001-stack.md) |
| Estilo | **Tailwind CSS v4** + tokens CSS | `@theme` gera utilitários a partir dos tokens; um único lugar define a paleta |
| Componentes | **shadcn/ui** (base Radix) | Código no repositório, não dependência. Radix resolve foco/teclado/ARIA do Dialog, Popover, RadioGroup |
| Animação | **Motion** (`motion/react`) | Respeita `prefers-reduced-motion`; só `transform`/`opacity` |
| Fontes | **next/font** (self-host) | Zero CLS, sem request ao CDN do Google (que expõe IP → ponto LGPD) |
| Banco | **PostgreSQL** (Supabase, região `sa-east-1`) | Precisamos de `EXCLUDE USING gist` para impedir overbooking no nível do banco. [ADR-004](adr/ADR-004-antioverbooking.md) |
| ORM | **Drizzle** | SQL-first: constraints e índices ficam explícitos e versionados |
| Auth (admin) | **Auth.js v5** + Google Provider | O mesmo consentimento que loga a médica já concede escopo do Calendar |
| E-mail | **Resend** + React Email | Anexo `.ics` com `Content-Type: text/calendar; method=REQUEST` |
| Datas | **Luxon** ou `Temporal` (polyfill) | Nunca aritmética manual de fuso. [§7](#7-fuso-horário) |
| Validação | **Zod** | Mesmo schema no cliente e no servidor |
| Analytics | **Plausible** ou **Umami** | Sem cookies → **sem banner de consentimento**. [ADR-005](adr/ADR-005-analytics-sem-cookies.md) |
| Erros | **Sentry** | Com `beforeSend` que remove PII |
| Testes | **Vitest** + **Playwright** + **axe-core** | Matemática de slots é a parte que mais quebra em silêncio |
| CI/CD | **GitHub Actions** → **Vercel** | Preview por PR |

### 5.1 Alternativa avaliada e recusada

O protótipo HTML atual traz comentários indicando **FastAPI** como backend futuro.
É uma escolha tecnicamente válida — e recusada por motivo operacional, não técnico:
dois runtimes (Node para o front, Python para a API) significam dois deploys, dois
conjuntos de dependências, dois lugares onde CORS e variáveis de ambiente podem
divergir. Para **um** desenvolvedor e **uma** médica, o custo de coordenação supera o
ganho. Se no futuro entrar processamento de dados ou ML, um serviço Python separado
pode ser adicionado sem reescrever o site. Registrado em
[ADR-001](adr/ADR-001-stack.md).

---

## 6. Modelo de dados

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Perfil (uma linha hoje; a coluna existe para não precisar migrar depois)
CREATE TABLE practitioner (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       text NOT NULL,
  crm             text NOT NULL,
  timezone        text NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Modalidade: presencial, teleconsulta, retorno...
CREATE TABLE appointment_type (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES practitioner(id),
  slug            text NOT NULL,
  label           text NOT NULL,
  duration_min    integer NOT NULL CHECK (duration_min BETWEEN 10 AND 240),
  buffer_before_min integer NOT NULL DEFAULT 0,
  buffer_after_min  integer NOT NULL DEFAULT 10,
  location_kind   text NOT NULL CHECK (location_kind IN ('in_person','telehealth')),
  is_active       boolean NOT NULL DEFAULT true,
  UNIQUE (practitioner_id, slug)
);

-- Regra semanal recorrente: "toda terça, 14:00–18:00"
CREATE TABLE availability_rule (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES practitioner(id),
  weekday         smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=domingo
  start_time      time NOT NULL,   -- hora LOCAL da clínica
  end_time        time NOT NULL,
  location_kind   text NOT NULL,
  valid_from      date,
  valid_until     date,
  CHECK (start_time < end_time)
);

-- Exceção pontual: férias, congresso, plantão
CREATE TABLE availability_exception (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES practitioner(id),
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('block','extra')),
  note            text,
  CHECK (starts_at < ends_at)
);

CREATE TABLE appointment (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id   uuid NOT NULL REFERENCES practitioner(id),
  type_id           uuid NOT NULL REFERENCES appointment_type(id),
  starts_at         timestamptz NOT NULL,
  ends_at           timestamptz NOT NULL,
  status            text NOT NULL DEFAULT 'held'
                    CHECK (status IN ('held','confirmed','cancelled','no_show','completed')),

  patient_name      text NOT NULL,
  patient_email     citext NOT NULL,
  patient_phone     text NOT NULL,
  patient_note      text,               -- DADO SENSÍVEL: opcional, consentido, purgado em 90d

  consent_lgpd_at   timestamptz NOT NULL,
  consent_health_at timestamptz,        -- só se patient_note preenchido
  consent_ip_hash   text NOT NULL,      -- SHA-256(ip + salt) — prova sem guardar IP

  google_event_id   text,
  sync_state        text NOT NULL DEFAULT 'pending'
                    CHECK (sync_state IN ('pending','synced','failed','skipped')),
  sync_attempts     smallint NOT NULL DEFAULT 0,
  sync_last_error   text,

  manage_token_hash text NOT NULL,      -- SHA-256 do token do link de gestão
  ics_uid           text NOT NULL UNIQUE,
  ics_sequence      integer NOT NULL DEFAULT 0,  -- RFC 5545: incrementa a cada alteração

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  held_until        timestamptz,        -- reserva temporária durante o checkout

  CHECK (starts_at < ends_at)
);

-- ►► A trava anti-overbooking. Aplicada pelo BANCO, não pela aplicação. ◄◄
ALTER TABLE appointment ADD CONSTRAINT appointment_no_overlap
  EXCLUDE USING gist (
    practitioner_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status IN ('held','confirmed'));

CREATE INDEX ON appointment (practitioner_id, starts_at)
  WHERE status IN ('held','confirmed');
CREATE INDEX ON appointment (sync_state) WHERE sync_state IN ('pending','failed');

-- Token OAuth da médica (refresh token cifrado em repouso)
CREATE TABLE calendar_connection (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id    uuid NOT NULL REFERENCES practitioner(id),
  provider           text NOT NULL CHECK (provider = 'google'),  -- CalDAV fora de escopo
  account_email      text NOT NULL,
  calendar_id        text NOT NULL,
  refresh_token_enc  bytea NOT NULL,     -- AES-256-GCM
  sync_token         text,               -- incremental sync do Google
  channel_id         text,               -- canal push
  channel_expires_at timestamptz,
  revoked_at         timestamptz,
  UNIQUE (practitioner_id, provider, calendar_id)
);

-- Trilha de auditoria (LGPD Art. 37)
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  actor       text NOT NULL,     -- 'patient' | 'practitioner' | 'system'
  action      text NOT NULL,     -- 'appointment.created' | 'data.erased' | ...
  subject_id  uuid,
  meta        jsonb NOT NULL DEFAULT '{}'
);
```

### 6.1 Por que a constraint de exclusão importa

Sem ela, duas requisições simultâneas para o mesmo horário passam ambas pelo
`SELECT ... WHERE NOT EXISTS`, e ambas inserem. É a *race condition* clássica de
sistemas de reserva — rara em testes, inevitável em produção quando a médica divulga
o link no Instagram. A `EXCLUDE USING gist` faz o **PostgreSQL** rejeitar a segunda
inserção, independentemente de quantas instâncias serverless estejam rodando. A
aplicação captura o erro `23P01` e responde "horário acabou de ser ocupado". Ver
[ADR-004](adr/ADR-004-antioverbooking.md).

---

## 7. Fuso horário

O protótipo atual contém:

```js
// America/Sao_Paulo = UTC-3 (sem horário de verão)
const utc = dt => new Date(dt.getTime() + 3*3600000);
```

Está **correto hoje** (o horário de verão foi extinto pelo Decreto nº 9.772/2019) e
**errado como arquitetura**. Se o horário de verão voltar — o assunto reaparece
periodicamente no Congresso —, todo agendamento futuro passa a sair uma hora
deslocado, silenciosamente, sem erro em log algum.

**Regras invioláveis:**

1. Persistir **sempre** em `timestamptz` (UTC no disco).
2. Converter **somente** na borda, com biblioteca de IANA tz (`America/Sao_Paulo`).
3. `availability_rule` guarda **hora local** (`time`), não UTC — "toda terça às 14h"
   é uma afirmação sobre o relógio da parede, e deve continuar valendo se a regra do
   fuso mudar.
4. Nunca somar/subtrair offset numérico à mão.
5. Em teleconsulta, exibir também o fuso do paciente
   (`Intl.DateTimeFormat().resolvedOptions().timeZone`), com o da clínica como
   referência: `14:00 (Brasília) · 13:00 no seu horário`.
6. O `.ics` usa `DTSTART;TZID=America/Sao_Paulo` com `VTIMEZONE` embutido — não UTC
   convertido, para que o evento acompanhe eventual mudança de regra.

---

## 8. Fluxos principais

### 8.1 Cálculo de disponibilidade

```
GET /api/disponibilidade?tipo=<slug>&de=2026-09-14&ate=2026-09-27

 1. Carrega availability_rule → expande em intervalos locais no período
 2. Aplica availability_exception (kind='block' remove, 'extra' adiciona)
 3. Google FreeBusy (cache 60 s) → remove compromissos pessoais
 4. Remove appointment com status held|confirmed (+ buffers)
 5. Fatia em slots de duration_min
 6. Aplica lead time (mín. 12 h de antecedência) e horizonte (máx. 60 dias)
 7. Descarta slots parciais no fim da janela
 → 200 { timezone, dias: [{ data, slots: [{ inicio, fim }] }] }
```

Cache: `s-maxage=60, stale-while-revalidate=300`. Invalidado por webhook do Google
e por qualquer escrita em `appointment`/`availability_*`.

### 8.2 Confirmação (o caminho crítico)

```
POST /api/agendamentos   { tipo, inicio, nome, email, telefone, nota?, consentimentos }
                         Header: Idempotency-Key: <uuid do cliente>

 ├─ 1. Zod valida  ─────────────────────────► 422 + erros por campo
 ├─ 2. Rate limit (IP + e-mail) ────────────► 429
 ├─ 3. Idempotency-Key já visto? ───────────► 200 com o resultado anterior
 ├─ 4. INSERT status='held', held_until=now()+10min
 │     └─ erro 23P01 (exclusion) ───────────► 409 "horário indisponível"
 ├─ 5. Revalida contra o FreeBusy ao vivo
 │     └─ conflito ─────────────────────────► rollback + 409
 ├─ 6. COMMIT status='confirmed'  ◄── ponto de não-retorno
 │
 ├─ 7. [assíncrono] Google Calendar insert  ─┐
 ├─ 8. [assíncrono] e-mail + .ics           ─┤ falha aqui NÃO
 └─ 9. [assíncrono] audit_log               ─┘ desfaz o passo 6
      → 201 { id, inicio, fim, urlGestao, urlIcs, urlGoogle }
```

**Decisão-chave:** os passos 7–9 são **assíncronos e reprocessáveis**. Se a API do
Google estiver fora do ar, a consulta **continua marcada** — `sync_state='pending'`,
e um job de reconciliação (a cada 5 min) reprocessa com backoff exponencial. Se o
paciente conseguiu marcar mas o evento não apareceu na agenda, é um problema
operacional recuperável; se o paciente vê "erro" e desiste, é uma consulta perdida.

O e-mail depende do mesmo princípio: a tela de sucesso já oferece **download do
`.ics` e link do Google Calendar gerados no cliente**, então o paciente sai com o
compromisso na mão mesmo que o e-mail atrase.

### 8.3 Mudança feita direto no celular da médica

```
Google Calendar (push notification) ──► POST /api/webhooks/google
                                          │
                                          ├─ valida X-Goog-Channel-Token
                                          ├─ events.list(syncToken) → delta
                                          ├─ evento nosso apagado/movido?
                                          │    └─ marca appointment cancelled/reagendado
                                          │       + notifica paciente (.ics SEQUENCE+1,
                                          │         METHOD:CANCEL ou REQUEST)
                                          └─ invalida cache de disponibilidade
```

Canais push do Google expiram (máx. ~30 dias). Um cron diário renova qualquer canal
com `channel_expires_at < now() + 3 dias`. Como rede de segurança, um *polling* a
cada 15 min com `syncToken` cobre webhooks perdidos.

---

## 9. Segurança

| Vetor | Mitigação |
|---|---|
| Refresh token vazado | AES-256-GCM em repouso, chave em `ENCRYPTION_KEY` (Vercel env, não no repo); rotação documentada |
| Enumeração de agendamentos | `manage_token` de 32 bytes, comparado por hash em tempo constante; expira em 90 d |
| Spam de agendamento | Rate limit por IP+e-mail, honeypot, Turnstile (invisível) a partir do 3º POST/h |
| Overbooking | Constraint no banco (§6.1) |
| Replay do webhook | `X-Goog-Channel-Token` secreto + verificação de `resourceId` |
| PII em log | `beforeSend` no Sentry remove `patient_*`; logs estruturados nunca recebem `patient_note` |
| XSS | RSC + escape padrão; `patient_note` nunca renderizado como HTML |
| Cabeçalhos | CSP estrita (sem `unsafe-inline`, nonce por request), HSTS, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restritivo |

---

## 10. Como as fases se encaixam

```
FASE 01  Design System ────────┐
FASE 02  Fundação do projeto ──┴──► FASE 03  Site institucional
                                          │
FASE 04  Motor de disponibilidade ────────┤
   │                                      │
   ├─► FASE 05  Google Calendar           │
   ├─► FASE 06  .ics (paciente)           │
   │                                      │
   └──────────► FASE 07  Fluxo de agendamento ◄──┘
                     │
                     ├─► FASE 08  Notificações
                     └─► FASE 09  Painel admin
                              │
        FASE 10  LGPD + CFM ──┤
        FASE 11  SEO + perf ──┤
        FASE 12  QA + a11y ───┼──► FASE 13  Deploy
                              │         │
                              └─────────┴──► FASE 14  Roadmap
```

Caminho crítico: **02 → 04 → 05 → 07**. As fases 01, 03, 10 e 11 podem correr em
paralelo com as de backend.

---

## 11. Registros de decisão

| ADR | Assunto |
|---|---|
| [ADR-001](adr/ADR-001-stack.md) | Next.js full-stack em vez de front estático + FastAPI |
| [ADR-002](adr/ADR-002-google-fonte-da-verdade.md) | Google Calendar como fonte da verdade da agenda |
| [ADR-003](adr/ADR-003-ics-para-o-paciente.md) | `.ics` universal para o paciente; agenda da médica só no Google |
| [ADR-004](adr/ADR-004-antioverbooking.md) | Anti-overbooking com `EXCLUDE USING gist` |
| [ADR-005](adr/ADR-005-analytics-sem-cookies.md) | Analytics sem cookies para eliminar o banner |
