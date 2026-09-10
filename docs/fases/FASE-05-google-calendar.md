# FASE 05 — Integração com Google Calendar

> **Objetivo:** ler a agenda real da médica e escrever nela — de forma que
> continue funcionando quando o Google falhar.
> **Depende de:** FASE-02, FASE-04 · **Habilita:** FASE-07
> **Estimativa:** 4 dias

---

## 1. Configuração no Google Cloud

1. Criar projeto **"Agenda Dra. Andressa"**.
2. Ativar **Google Calendar API**.
3. Tela de consentimento OAuth: tipo **External**, modo **Testing**, com
   `andressa15correia@gmail.com` como *test user*.
4. Credencial **OAuth Client ID → Web application**:
   - Origens: `https://draandressacorreia.com.br`, `http://localhost:3000`
   - Redirect: `https://draandressacorreia.com.br/api/oauth/google/callback`

### Sobre ficar em "Testing"

Escopos de Calendar são **sensíveis**: publicar o app exige verificação pelo Google
(vídeo de demonstração, política de privacidade, às vezes auditoria de segurança).
Para um app de **um usuário**, isso é burocracia sem retorno.

Em modo Testing, com a conta dela listada como *test user*:
- funciona normalmente;
- o refresh token **não expira** em 7 dias (essa expiração vale para apps em modo
  *Testing* **publicados como External não verificados** — o *test user* explícito
  não sofre a limitação);
- a tela mostra um aviso de "app não verificado", que ela aceita **uma vez**.

> ⚠️ Verificar esse comportamento no primeiro deploy: se o refresh token expirar em
> 7 dias, o plano B é migrar para **Internal** com Google Workspace, ou publicar e
> passar pela verificação. Monitorar `invalid_grant` (§6) cobre o risco.

### Escopos — mínimos necessários

```
https://www.googleapis.com/auth/calendar.events     # criar/editar NOSSOS eventos
https://www.googleapis.com/auth/calendar.readonly   # FreeBusy
```

Não pedir `https://www.googleapis.com/auth/calendar` (acesso total). Escopo amplo é
risco desnecessário e piora a tela de consentimento.

---

## 2. Fluxo OAuth

```
/admin/integracoes
   └─ [Conectar Google Agenda]
        └─ GET /api/oauth/google/start
             ├─ gera `state` (CSRF, cookie httpOnly, 10 min)
             └─ redirect → accounts.google.com/o/oauth2/v2/auth
                             ?access_type=offline      ← indispensável p/ refresh
                             &prompt=consent           ← força novo refresh token
                             &include_granted_scopes=true
        └─ callback → /api/oauth/google/callback
             ├─ valida `state`
             ├─ troca `code` por { access_token, refresh_token }
             ├─ confirma que o e-mail == ADMIN_EMAIL
             ├─ cifra refresh_token (AES-256-GCM)
             ├─ grava em calendar_connection
             ├─ registra canal push (§4)
             └─ redirect /admin/integracoes?conectado=1
```

### Criptografia do refresh token

```ts
// lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'base64'); // 32 bytes

export function cifrar(texto: string): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', KEY, iv);
  const dados = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), dados]);  // iv(12) | tag(16) | dados
}

export function decifrar(blob: Buffer): string {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const d = createDecipheriv('aes-256-gcm', KEY, iv);
  d.setAuthTag(tag);
  return d.update(blob.subarray(28)).toString('utf8') + d.final('utf8');
}
```

GCM traz autenticação junto: token adulterado falha na decifragem em vez de virar
lixo silencioso.

---

## 3. Leitura — FreeBusy

```ts
// lib/calendar/freebusy.ts
export async function buscarOcupados(
  de: Date, ate: Date,
): Promise<{ intervalos: Interval[]; degradado: boolean }> {
  try {
    const { data } = await calendar.freebusy.query({
      requestBody: {
        timeMin: de.toISOString(),
        timeMax: ate.toISOString(),
        timeZone: TZ_CLINICA,
        items: [{ id: env.GOOGLE_CALENDAR_ID }],
      },
    });
    const busy = data.calendars?.[env.GOOGLE_CALENDAR_ID]?.busy ?? [];
    return { intervalos: busy.map(paraInterval), degradado: false };
  } catch (e) {
    logger.error({ e }, 'freebusy falhou');
    const cache = await lerCacheOcupados(de, ate);
    if (cache) return { intervalos: cache, degradado: true };
    throw new FreeBusyIndisponivel();   // tratado em FASE-04 §6
  }
}
```

**Detalhe fácil de errar:** o FreeBusy do Google **já** ignora eventos marcados como
"Disponível" (`transparency: transparent`). Não é preciso filtrar de novo — e
filtrar duas vezes esconderia compromissos reais.

---

## 4. Escrita — criação do evento

```ts
await calendar.events.insert({
  calendarId: env.GOOGLE_CALENDAR_ID,
  sendUpdates: 'none',      // NÓS enviamos o e-mail (FASE-08), não o Google
  requestBody: {
    summary: `${tipo.label} — ${paciente.nome}`,
    description: [
      `Paciente: ${paciente.nome}`,
      `Telefone: ${paciente.telefone}`,
      `E-mail: ${paciente.email}`,
      motivo ? `Motivo informado: ${motivo}` : null,
      '',
      `Gerir: ${urlGestao}`,
    ].filter(Boolean).join('\n'),
    start: { dateTime: inicio.toISOString(), timeZone: TZ_CLINICA },
    end:   { dateTime: fim.toISOString(),    timeZone: TZ_CLINICA },
    location: tipo.modalidade === 'in_person'
      ? 'Consultório — Guarulhos, SP'
      : 'Teleconsulta',
    reminders: { useDefault: false, overrides: [
      { method: 'popup', minutes: 24 * 60 },
      { method: 'popup', minutes: 120 },
    ]},
    extendedProperties: { private: { appointmentId: agendamento.id } },
  },
}, { headers: { 'X-Goog-Api-Version': '3' } });
```

Pontos deliberados:

- `sendUpdates: 'none'` — o convite do Google usaria o remetente pessoal dela e
  duplicaria o nosso e-mail de confirmação.
- `extendedProperties.private.appointmentId` — âncora para reconciliar quando o
  evento voltar pelo webhook.
- **`patient_note` (motivo) é dado de saúde.** Vai no `description` porque a médica
  precisa dele para se preparar, e ela é a controladora — mas isso precisa constar
  do RIPD (FASE-10). Se ela preferir, uma flag `INCLUIR_MOTIVO_NO_EVENTO=false`
  substitui pelo link de gestão.

### Idempotência

Reprocessar não pode duplicar evento:

```ts
if (agendamento.google_event_id) {
  await calendar.events.patch({ eventId: agendamento.google_event_id, ... });
} else {
  const ev = await calendar.events.insert({ ... });
  await db.update(appointment)
          .set({ google_event_id: ev.data.id, sync_state: 'synced' })
          .where(eq(appointment.id, agendamento.id));
}
```

---

## 5. Webhook push — mudanças feitas no celular

### Registro do canal

```ts
await calendar.events.watch({
  calendarId: env.GOOGLE_CALENDAR_ID,
  requestBody: {
    id: randomUUID(),
    type: 'web_hook',
    address: `${env.NEXT_PUBLIC_SITE_URL}/api/webhooks/google`,
    token: env.GOOGLE_WEBHOOK_TOKEN,   // volta em X-Goog-Channel-Token
    expiration: String(Date.now() + 30 * 24 * 3600 * 1000),
  },
});
```

### Recebimento

```ts
export async function POST(req: Request) {
  if (req.headers.get('x-goog-channel-token') !== env.GOOGLE_WEBHOOK_TOKEN) {
    return new Response(null, { status: 401 });
  }
  if (req.headers.get('x-goog-resource-state') === 'sync') {
    return new Response(null, { status: 200 });   // handshake inicial
  }

  // O webhook NÃO diz o que mudou — só que algo mudou.
  const conexao = await carregarConexao();
  const { data } = await calendar.events.list({
    calendarId: env.GOOGLE_CALENDAR_ID,
    syncToken: conexao.sync_token ?? undefined,
    showDeleted: true,
  });

  for (const ev of data.items ?? []) {
    const id = ev.extendedProperties?.private?.appointmentId;
    if (!id) continue;                                   // evento pessoal dela
    if (ev.status === 'cancelled') await cancelarPorAgenda(id);
    else if (mudouHorario(ev)) await remarcarPorAgenda(id, ev);
  }

  await salvarSyncToken(data.nextSyncToken);
  revalidateTag('disponibilidade');
  return new Response(null, { status: 200 });
}
```

**Três armadilhas conhecidas:**

1. **O webhook não traz payload útil.** Só notifica que houve mudança; é preciso
   listar com `syncToken`.
2. **`syncToken` expira** (HTTP 410 `fullSyncRequired`). Tratar fazendo full sync e
   gravando o novo token — sem isso, a sincronização morre em silêncio.
3. **Canais expiram em ~30 dias.** Cron diário renova qualquer canal com
   `channel_expires_at < now() + 3 dias`. Sem isso, o webhook simplesmente para de
   chegar e ninguém percebe até o primeiro overbooking.

**Rede de segurança:** cron a cada 15 min faz `events.list(syncToken)` mesmo sem
webhook. Custo desprezível, cobre notificação perdida.

---

## 6. Falhas e recuperação

| Erro | Significado | Ação |
|---|---|---|
| `401 invalid_grant` | Refresh token revogado ou expirado | Marca `revoked_at`, alerta no `/admin`, e-mail para a médica: *"reconecte sua agenda"*. Sistema **continua agendando**, em modo degradado |
| `403 rateLimitExceeded` | Cota estourada | Backoff exponencial com jitter, máx. 5 tentativas |
| `403 forbiddenForNonOrganizer` | Evento criado por outra pessoa | Não tenta editar; loga |
| `404` em `patch` | Evento apagado direto no celular | Trata como cancelamento; confirma com a médica |
| `410 fullSyncRequired` | `syncToken` expirado | Full sync e regrava token |
| `5xx` / timeout | Instabilidade | `sync_state='failed'`, fila de reconciliação |

### Job de reconciliação

`/api/cron/reconciliar` a cada 5 min:

```sql
SELECT * FROM appointment
WHERE sync_state IN ('pending','failed')
  AND sync_attempts < 5
  AND starts_at > now()
ORDER BY starts_at
LIMIT 20;
```

Backoff: 1 min → 5 → 15 → 60 → 240. Na 5ª falha, alerta ao admin e Sentry.

---

## 7. Entregáveis

- [ ] `lib/calendar/google.ts` — cliente com refresh automático
- [ ] `lib/crypto.ts` — AES-256-GCM com testes
- [ ] `app/api/oauth/google/{start,callback}/route.ts`
- [ ] `app/api/webhooks/google/route.ts`
- [ ] `app/api/cron/{reconciliar,renovar-canal}/route.ts`
- [ ] `/admin/integracoes` — status da conexão, reconectar, revogar
- [ ] Fixtures de teste com respostas reais da API (gravadas, não inventadas)

## 8. Critérios de aceite

- [ ] Conectar a conta grava refresh token **cifrado** (verificado lendo o `bytea`)
- [ ] Agendamento confirmado aparece na agenda em < 10 s
- [ ] Apagar o evento no Google marca o agendamento como cancelado e notifica
- [ ] Mover o evento no Google atualiza `starts_at` e reenvia `.ics` com `SEQUENCE+1`
- [ ] Com a API mockada em erro, o agendamento **é criado** com `sync_state='pending'`
- [ ] Reconciliação recupera todos os pendentes quando a API volta
- [ ] `syncToken` expirado (410) dispara full sync sem intervenção
- [ ] Escopos concedidos são exatamente os dois listados — nem mais
