# FASE 13 — Deploy e observabilidade

> **Objetivo:** ir ao ar com segurança e saber, antes da médica, quando algo quebra.
> **Depende de:** todas · **Estimativa:** 2 dias

---

## 1. Ambientes

| Ambiente | URL | Banco | Google Calendar |
|---|---|---|---|
| Local | `localhost:3000` | Postgres em Docker | Calendário de teste |
| Preview | `*.vercel.app` (por PR) | Branch do Supabase | Calendário de teste |
| Produção | `draandressacorreia.com.br` | Supabase `sa-east-1` | Agenda real |

**Regra inegociável:** preview **nunca** aponta para a agenda real. Um teste
automatizado criando eventos na agenda da médica é o tipo de acidente que destrói
confiança. Chave separada, calendário separado, verificação no boot:

```ts
if (env.VERCEL_ENV !== 'production' && env.GOOGLE_CALENDAR_ID === CALENDARIO_REAL) {
  throw new Error('Ambiente não-produtivo apontando para a agenda real.');
}
```

---

## 2. Domínio e DNS

| Registro | Valor | Para |
|---|---|---|
| `A` / `CNAME` | Vercel | Site |
| `TXT` | `v=spf1 include:_spf.resend.com ~all` | SPF |
| `CNAME` ×3 | fornecidos pela Resend | DKIM |
| `TXT _dmarc` | `v=DMARC1; p=none; rua=mailto:...` → depois `p=quarantine` | DMARC |
| `CAA` | `0 issue "letsencrypt.org"` | Restringe emissão de certificado |

HTTPS automático pela Vercel; HSTS com `preload` só depois de duas semanas estáveis
(é difícil de reverter).

---

## 3. Cabeçalhos de segurança

```ts
// next.config.ts
const csp = [
  "default-src 'self'",
  "script-src 'self' 'nonce-{NONCE}' https://plausible.io",
  "style-src 'self' 'unsafe-inline'",          // Tailwind injeta estilo inline
  "img-src 'self' data: blob:",
  "font-src 'self'",                            // fontes self-hosted
  "connect-src 'self' https://plausible.io",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ');
```

Mais: `Strict-Transport-Security: max-age=63072000; includeSubDomains`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`.

`script-src` sem `unsafe-inline` só é possível porque não há script de terceiro —
consequência direta do ADR-005.

---

## 4. Cron (Vercel)

```jsonc
{
  "crons": [
    { "path": "/api/cron/expirar-reservas", "schedule": "*/2 * * * *" },
    { "path": "/api/cron/reconciliar",      "schedule": "*/5 * * * *" },
    { "path": "/api/cron/sync-google",      "schedule": "*/15 * * * *" },
    { "path": "/api/cron/lembretes-h2",     "schedule": "0 * * * *" },
    { "path": "/api/cron/lembretes-d1",     "schedule": "0 21 * * *" },
    { "path": "/api/cron/renovar-canal",    "schedule": "0 4 * * *" },
    { "path": "/api/cron/retencao",         "schedule": "0 5 * * *" }
  ]
}
```

> ⚠️ **Tudo em UTC.** `0 21 * * *` = 18h em Brasília. `0 18 * * *` mandaria o
> lembrete às 15h. Manter este comentário no arquivo.

Toda rota de cron valida `Authorization: Bearer ${CRON_SECRET}` — sem isso, qualquer
pessoa dispara os jobs.

---

## 5. Observabilidade

### Sentry, com PII removida

```ts
Sentry.init({
  dsn: env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend(evento) {
    // dado de saúde e contato NUNCA saem daqui
    if (evento.request?.data) {
      for (const campo of ['patient_note', 'patient_email',
                           'patient_phone', 'patient_name', 'motivo']) {
        delete (evento.request.data as Record<string, unknown>)[campo];
      }
    }
    return evento;
  },
});
```

### Alertas que importam

| Alerta | Gatilho | Canal |
|---|---|---|
| Agenda desconectada | `invalid_grant` do Google | E-mail à médica + Sentry |
| Fila de sincronização travada | ≥ 5 registros `failed` | E-mail ao dev |
| Erro no POST de agendamento | taxa > 5 % em 10 min | Sentry |
| Cron não executou | ausência de heartbeat em 2 ciclos | Sentry Cron Monitoring |
| E-mail com hard bounce | webhook da Resend | Log + aviso no `/admin` |
| Queda de performance | LCP > 2,5 s no campo | Vercel Analytics |

### Health check

`GET /api/health` → banco, Google (`calendar.list`), Resend, idade da fila de
sincronização. Consumido por um monitor externo (UptimeRobot) a cada 5 min.

---

## 6. Backup e recuperação

- Supabase: PITR (point-in-time recovery) habilitado — 7 dias.
- Dump diário para storage separado, retenção 30 dias.
- **Restauração testada** uma vez antes do go-live: um backup que nunca foi
  restaurado não é backup.
- RTO 4 h · RPO 1 h.

---

## 7. Checklist de go-live

**Antes**
- [ ] Migrations aplicadas, incluindo a constraint de exclusão
- [ ] Seed com dados reais (modalidades, horários reais da médica)
- [ ] Google Calendar conectado à conta real
- [ ] SPF, DKIM e DMARC verdes; teste de envio real
- [ ] Feed `webcal://` assinado no iPhone dela e conferido
- [ ] CRM-SP **confirmado dígito a dígito** com a médica
- [ ] Revisão de conformidade (FASE-10) assinada
- [ ] Política de privacidade publicada
- [ ] Lighthouse ≥ 95/100/100
- [ ] Cron com `CRON_SECRET` configurado
- [ ] Sentry recebendo eventos, com PII filtrada
- [ ] Backup restaurado com sucesso em ambiente de teste

**No dia**
- [ ] DNS apontado, HTTPS ativo
- [ ] Agendamento de ponta a ponta em produção, com dados reais
- [ ] `.ics` verificado no iPhone da médica
- [ ] Cancelamento verificado — evento some do calendário
- [ ] Perfil da Empresa no Google atualizado com o link
- [ ] Link no Instagram

**Depois**
- [ ] Monitorar 48 h com atenção
- [ ] Conferir se os canais push do Google chegaram
- [ ] Revisão com a médica após a primeira semana

---

## 8. Runbook — incidentes prováveis

| Sintoma | Causa provável | Ação |
|---|---|---|
| Nenhum slot aparece | Google desconectado ou sem regra de disponibilidade | `/api/health`; reconectar em `/admin/integracoes` |
| Slots errados por 1 h | Alguém escreveu offset fixo | Procurar `3600000` no código; conferir `lib/datetime.ts` |
| Evento não aparece na agenda | Fila de sincronização | `SELECT * FROM appointment WHERE sync_state='failed'`; rodar `/api/cron/reconciliar` |
| Overbooking | Constraint removida numa migration | Conferir `\d appointment`; recriar `appointment_no_overlap` |
| E-mail em spam | DKIM/DMARC quebrado | `mail-tester`; revisar DNS |
| Cancelamento não some do iPhone | `UID` mudou ou `SEQUENCE` não subiu | Conferir `ics_uid` e `ics_sequence` |
| Webhook parou | Canal expirou | Rodar `/api/cron/renovar-canal`; conferir `channel_expires_at` |
