# Operação — do zero ao ar, e o dia a dia

> Guia prático para colocar o site em produção e mantê-lo. Complementa a
> [FASE-13](fases/FASE-13-deploy-observabilidade.md) (o porquê) com o
> **como**, refletindo o código como ele está.

---

## 1. Peças e custo

| Serviço | Para quê | Plano |
|---|---|---|
| **Vercel** | Hospedagem, funções, crons | **Pro** — o Hobby só permite cron diário; os de 5 e 15 min são essenciais |
| **Supabase** | PostgreSQL em `sa-east-1` | Free/Pro (PITR no Pro) |
| **Google Cloud** | OAuth (login do painel + agenda) | Gratuito |
| **Resend** | E-mail transacional | Free até 3 mil/mês |
| Sentry *(opcional)* | Erros sem dado pessoal | Free |
| Plausible *(opcional)* | Visitas, sem cookie | Pago |

Região da função: `gru1` (São Paulo, em `vercel.json`) — ao lado do banco.

## 2. Primeira implantação

### 2.1 Banco (Supabase)

1. Criar projeto em **South America (São Paulo)**.
2. Copiar as duas URLs: *Transaction pooler* (porta 6543) → `DATABASE_URL`;
   *Direct connection* (5432) → `DATABASE_URL_UNPOOLED`, ambas com
   `?sslmode=require`. Em *Settings → Database → SSL*: ligar **Enforce SSL**
   e baixar o certificado da CA → `DATABASE_CA_CERT` (PEM numa linha só, com
   `\n`). Com a CA, o site **verifica** o certificado do banco; sem ela, só
   cifra. Host remoto com `sslmode=disable`/`allow`/`prefer` é recusado
   (`lib/db/tls.ts`).
3. Aplicar as migrations **pelo journal** (nunca `psql -f`):
   ```bash
   DATABASE_URL_UNPOOLED="…" npm run db:migrate
   ```
   O comando falha se a constraint `appointment_no_overlap` não existir no fim.
4. Dados iniciais: `npm run db:seed` cria só o profissional e as modalidades —
   com banco **remoto** ele **nunca toca nos horários** (horário fictício só em
   banco local, ou com `SEED_CONFIRMO_FICTICIO=sim`). Em seguida, configure a semana padrão real no painel
   (`/admin/disponibilidade`). Rodar de novo é seguro: não apaga o que a
   médica configurou.

### 2.2 Google Cloud (login + agenda)

1. Projeto "Agenda Dra. Andressa" → ativar **Google Calendar API**.
2. Tela de consentimento: **External**, modo **Testing**, com a conta dela como
   *test user* ([FASE-05 §1](fases/FASE-05-google-calendar.md)).
   Escopos: `openid`, `email`, `calendar.events`, `calendar.readonly`.
3. Credencial **OAuth Client ID → Web application**:
   - origem: `https://draandressacorreia.com.br`
   - redirect: `https://draandressacorreia.com.br/api/oauth/google/callback`
   - (preview/local: acrescentar as URLs correspondentes)
4. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` na Vercel.

### 2.3 E-mail (Resend)

1. Adicionar o domínio e publicar no DNS: SPF (`include:_spf.resend.com`),
   os 3 CNAMEs de DKIM e `_dmarc` com `p=none` (subir para `quarantine` após
   duas semanas limpas).
2. `RESEND_API_KEY`, `EMAIL_FROM` (`contato@draandressacorreia.com.br`),
   `EMAIL_REPLY_TO` (e-mail pessoal dela).
3. Webhook → `https://draandressacorreia.com.br/api/webhooks/resend`, eventos
   `email.bounced` e `email.complained`; segredo em `RESEND_WEBHOOK_SECRET`.
4. Verificar com [mail-tester](https://www.mail-tester.com): alvo ≥ 9/10.

### 2.4 Variáveis na Vercel

Ver `.env.example` — cada uma tem o comando para gerar. Obrigatórias em
produção: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `TOKEN_SALT`,
`NEXT_PUBLIC_SITE_URL` (`https://` — o build de produção falha sem isso),
`AUTH_SECRET`, `ADMIN_EMAIL`, `GOOGLE_*`, `ENCRYPTION_KEY`, `CRON_SECRET`,
`RESEND_*`, `EMAIL_*`. Recomendada: `DATABASE_CA_CERT` (verifica o
certificado do banco).

| Variável | ⚠️ |
|---|---|
| `TOKEN_SALT` | **Nunca trocar** depois do go-live: todos os links de consulta param de abrir |
| `ENCRYPTION_KEY` | Trocar exige reconectar a agenda (o token cifrado deixa de abrir) |
| `AUTH_SECRET` | Trocar derruba a sessão do painel (útil em incidente). Para sair de um aparelho perdido basta "Sair" em qualquer outro: revoga todas as sessões |
| `ADMIN_EMAIL` | Em **preview**, use uma conta de teste: fora da produção o sistema recusa conectar a agenda real |
| `AGENDAMENTO_SEM_GOOGLE` | Deixe **vazio** em produção depois de conectar a agenda |

### 2.5 Firewall da Vercel (antes de divulgar)

Firewall → Custom Rules, com ação *Rate limit* por IP (ver
`docs/SEGURANCA.md §4`): `POST /api/agendamentos` 10/min,
`GET /api/disponibilidade` 60/min, `GET /api/health` 30/min. O site já tem
limites próprios (5 por IP/hora, 3 futuras por e-mail, 30 por hora no total);
o WAF corta a rajada antes de chegar à função.

### 2.6 Conectar a agenda

1. `https://…/admin` → Entrar com Google (a conta do `ADMIN_EMAIL`).
2. Integrações → **Conectar Google Agenda** → aceitar os dois escopos.
3. Conferir "Conectada", "Avisos instantâneos ativos até…" e a fila zerada.

## 3. Crons (vercel.json — tudo em UTC)

| Rota | Quando | O quê |
|---|---|---|
| `/api/cron/reconciliar` | a cada 5 min | Consultas → agenda do Google (backoff 1→5→15→60→240 min) |
| `/api/cron/notificacoes` | a cada 5 min | Reenvia e-mails que falharam |
| `/api/cron/sync-google` | a cada 15 min | Lê mudanças da agenda mesmo sem webhook |
| `/api/cron/lembretes-h2` | de hora em hora | Lembrete ~2 h antes |
| `/api/cron/lembretes-d1` | `0 21 * * *` | Lembrete da véspera — **21:00 UTC = 18:00 em Brasília** |
| `/api/cron/renovar-canal` | `0 4 * * *` | Renova o canal push (expira em ~30 dias) |
| `/api/cron/retencao` | `0 5 * * *` | LGPD: motivo e recado 90 dias, contato 5 anos (o evento do Google é redigido na reconciliação seguinte) |

Todas exigem `Authorization: Bearer $CRON_SECRET` (a Vercel envia sozinha).
Sem `CRON_SECRET`, respondem 401 — nunca ficam abertas.

Não há cron de "reservas expiradas": o fluxo grava a consulta já
`confirmed`, sem reserva temporária (`held`), então não há o que expirar.

## 4. Monitoramento

- **`GET /api/health`** → em público só `{ status }` (`ok`, `degradado` ou
  `fora`); 503 sem banco. O detalhe (`banco`, `agenda`, `email`,
  `filaSyncMin`, …) sai com `Authorization: Bearer $CRON_SECRET`. Resposta em
  cache de 30 s. Apontar um monitor externo (UptimeRobot, monitor de palavra-
  chave) a cada 5 min; alertar em 503 e em `"degradado"` por mais de 30 min.
- **Painel**: faixa vermelha em todas as telas se a agenda cair; Integrações
  mostra fila, falhas e e-mails devolvidos.
- **E-mails automáticos à médica**: agenda desconectada (1×/dia), consulta que
  não chegou à agenda após 5 tentativas, conflito ao mover evento, e-mail de
  paciente devolvido.
- **Sentry** (se `SENTRY_DSN`): erros não tratados de qualquer rota, sem PII.

## 5. Checklist de go-live

**Antes**
- [ ] `npm run db:migrate` em produção — trava anti-overbooking presente
- [ ] Horários **reais** na semana padrão (`/admin/disponibilidade`)
- [ ] Agenda conectada à conta real; `AGENDAMENTO_SEM_GOOGLE` vazio
- [ ] SPF, DKIM e DMARC verdes; e-mail de teste real recebido e aberto no iPhone
- [ ] `CRON_SECRET` definido; crons aparecendo no painel da Vercel
- [ ] Revisão jurídica da política, dos termos e do [RIPD](RIPD.md)
- [ ] Endereço definido **ou** ciência do modo sem endereço ([FASE-11](fases/FASE-11-seo-performance.md))
- [ ] Backup: PITR ativo e uma restauração testada
- [ ] Banco com **Enforce SSL** e `DATABASE_CA_CERT`; WAF da Vercel (§2.5)
- [ ] Verificação em duas etapas forte na conta Google da médica
- [ ] `npm audit --omit=dev` limpo e CI verde no commit do deploy

**No dia**
- [ ] Agendar de ponta a ponta com dados reais, no celular
- [ ] Evento aparece na agenda dela em segundos
- [ ] `.ics` do e-mail abre no iPhone; **cancelar remove o evento do iPhone**
- [ ] Apagar/mover um evento de teste no Google cancela/remarca no site
- [ ] Prévia do link no WhatsApp com retrato, nome e CRM
- [ ] Perfil da Empresa no Google com o link de agendamento ([guia](GUIA-PERFIL-EMPRESA-GOOGLE.md))

## 6. Runbook

| Sintoma | Onde olhar | Ação |
|---|---|---|
| Nenhum horário no site | `/api/health` (`agenda`), `/admin/integracoes` | Reconectar a agenda; conferir a semana padrão |
| Só aparecem horários de depois de amanhã | Agenda revogada ou Google fora | Reconectar; o site volta ao normal sozinho |
| Consulta não aparece na agenda | Integrações → fila; `sync_last_error` | "Sincronizar agora"; se `failed` esgotou: reconectar e sincronizar |
| Mudança feita no celular não refletiu | `last_sync_at` em Integrações | "Sincronizar agora"; o cron de 15 min cobre webhook perdido |
| Paciente não recebeu e-mail | Painel → consulta ("E-mail não entregue") | Confirmar pelo WhatsApp; conferir DNS se for geral |
| Horários 1 h deslocados | Alguém escreveu offset fixo | `lib/datetime.ts` é o único lugar de fuso; o ESLint bloqueia o resto |
| Overbooking | `\d appointment` no banco | Recriar `appointment_no_overlap` por migration (nunca `psql -f`) |
| Cancelamento não some do iPhone | `ics_uid` / `ics_sequence` da consulta | UID não pode mudar; SEQUENCE precisa subir |
| Suspeita de acesso indevido ao painel | `audit_log` (`admin.login*`) | "Sair" (revoga todas as sessões); girar `AUTH_SECRET`; revisar `ADMIN_EMAIL` |
| Rajada de agendamentos falsos | Log `agendamento.limite-global`; painel | Ligar/apertar o WAF (§2.5); cancelar pelo painel; ver `docs/SEGURANCA.md` (SEC-02) |
| Build de produção falha na config | `NEXT_PUBLIC_SITE_URL` | Precisa ser `https://` |
| "Banco remoto exige TLS" no log | `DATABASE_URL` com `sslmode=disable/prefer` | Trocar por `sslmode=require` |

## 7. Desenvolvimento local

```bash
docker compose up -d postgres        # ou o initdb do CLAUDE.md
cp .env.example .env.local           # DATABASE_URL, TOKEN_SALT, NEXT_PUBLIC_SITE_URL
npm ci && npm run db:migrate && npm run db:seed
npm run dev
```

Sem Google configurado, o painel fica fechado e o site agenda só pelas regras
(em dev isso é permitido). Para testar o painel sem OAuth real, os testes E2E
assinam a sessão com o `AUTH_SECRET` de teste (`tests/e2e/admin.spec.ts`).
