/**
 * Cliente mínimo do Google (OAuth 2.0 + Calendar API v3) sobre `fetch`.
 *
 * Por que não o pacote `googleapis`: são ~100 MB e centenas de APIs para
 * usarmos seis endpoints. Aqui cada chamada é explícita, tipada só no que
 * lemos, e trivial de simular nos testes (basta trocar o `fetch`).
 *
 * Escopos da agenda — EXATAMENTE os dois do plano (FASE-05 §1), nem mais:
 *   calendar.events   → criar/editar/apagar os NOSSOS eventos
 *   calendar.readonly → FreeBusy, sync incremental e canal push
 * O login do /admin usa outro consentimento (openid + email), descartado
 * logo após confirmar a identidade.
 */
import { envGoogle } from '../env';

export const ESCOPOS_AGENDA = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
] as const;
export const ESCOPOS_LOGIN = ['openid', 'email'] as const;

const URL_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const URL_REVOGAR = 'https://oauth2.googleapis.com/revoke';
const API = 'https://www.googleapis.com/calendar/v3';
const TIMEOUT_MS = 8_000;

// ── Erros ────────────────────────────────────────────────────────────────

/** Refresh token revogado/expirado: exige reconectar no /admin (§6). */
export class GoogleRevogadoError extends Error {
  constructor() { super('Acesso à agenda revogado ou expirado.'); this.name = 'GoogleRevogadoError'; }
}

export class GoogleApiError extends Error {
  constructor(readonly status: number, readonly motivo: string) {
    super(`Google API ${status} (${motivo})`);
    this.name = 'GoogleApiError';
  }
  /** Vale tentar de novo mais tarde? (5xx, 429, cota, rede) */
  get transitorio(): boolean {
    return this.status >= 500 || this.status === 429 || this.status === 0
      || this.motivo === 'rateLimitExceeded' || this.motivo === 'userRateLimitExceeded';
  }
}

async function chamar(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  } catch (e) {
    // Timeout/rede: sem status HTTP. Tratado como transitório.
    throw new GoogleApiError(0, e instanceof Error && e.name === 'TimeoutError' ? 'timeout' : 'rede');
  }
}

async function motivoDoErro(r: Response): Promise<string> {
  const corpo = await r.json().catch(() => null) as
    { error?: string | { errors?: { reason?: string }[]; status?: string } } | null;
  if (!corpo?.error) return 'desconhecido';
  if (typeof corpo.error === 'string') return corpo.error;          // OAuth: "invalid_grant"
  return corpo.error.errors?.[0]?.reason ?? corpo.error.status ?? 'desconhecido';
}

// ── OAuth ────────────────────────────────────────────────────────────────

export function urlAutorizacao(p: {
  redirectUri: string; state: string; escopos: readonly string[];
  offline: boolean; loginHint?: string;
}): string {
  const u = new URL(URL_AUTH);
  u.searchParams.set('client_id', envGoogle().GOOGLE_CLIENT_ID);
  u.searchParams.set('redirect_uri', p.redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', p.escopos.join(' '));
  u.searchParams.set('state', p.state);
  if (p.offline) {
    u.searchParams.set('access_type', 'offline');   // indispensável para o refresh token
    u.searchParams.set('prompt', 'consent');        // força NOVO refresh token ao reconectar
  } else {
    u.searchParams.set('prompt', 'select_account');
  }
  if (p.loginHint) u.searchParams.set('login_hint', p.loginHint);
  return u.toString();
}

export type Tokens = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
};

export async function trocarCodigo(code: string, redirectUri: string): Promise<Tokens> {
  const env = envGoogle();
  const r = await chamar(URL_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, redirect_uri: redirectUri, grant_type: 'authorization_code',
      client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
    }),
  });
  if (!r.ok) throw new GoogleApiError(r.status, await motivoDoErro(r));
  return r.json() as Promise<Tokens>;
}

export async function renovarAccessToken(refreshToken: string): Promise<{ token: string; expiraEm: number }> {
  const env = envGoogle();
  const r = await chamar(URL_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken, grant_type: 'refresh_token',
      client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
    }),
  });
  if (!r.ok) {
    const motivo = await motivoDoErro(r);
    if (motivo === 'invalid_grant') throw new GoogleRevogadoError();
    throw new GoogleApiError(r.status, motivo);
  }
  const t = await r.json() as Tokens;
  return { token: t.access_token, expiraEm: Date.now() + (t.expires_in - 60) * 1000 };
}

/** Revoga o token no Google (desconectar no /admin). Melhor esforço. */
export async function revogarToken(token: string): Promise<void> {
  await chamar(URL_REVOGAR, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined);
}

/**
 * E-mail do `id_token`. O token veio DIRETO do endpoint de token do Google,
 * por TLS, na troca do código — o OpenID Connect Core §3.1.3.7 dispensa
 * validar a assinatura nesse caso. Ainda assim conferimos `aud` e `iss`.
 */
export function emailDoIdToken(idToken: string): { email: string; verificado: boolean } | null {
  const partes = idToken.split('.');
  if (partes.length !== 3) return null;
  try {
    const p = JSON.parse(Buffer.from(partes[1]!, 'base64url').toString('utf8')) as {
      email?: string; email_verified?: boolean | string; aud?: string; iss?: string; exp?: number;
    };
    if (p.aud !== envGoogle().GOOGLE_CLIENT_ID) return null;
    if (p.iss !== 'https://accounts.google.com' && p.iss !== 'accounts.google.com') return null;
    if (!p.email || (p.exp && p.exp * 1000 < Date.now())) return null;
    return { email: p.email.toLowerCase(), verificado: p.email_verified === true || p.email_verified === 'true' };
  } catch {
    return null;
  }
}

// ── Calendar API ─────────────────────────────────────────────────────────

export type EventoGoogle = {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
  updated?: string;
};

export type CorpoEvento = {
  summary: string;
  description: string;
  location: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  reminders: { useDefault: false; overrides: { method: 'popup'; minutes: number }[] };
  extendedProperties: { private: Record<string, string> };
  transparency?: 'opaque';
};

export type PaginaEventos = {
  items?: EventoGoogle[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

/**
 * Cliente autenticado. `obterToken` devolve um access token válido (a
 * camada de conexão cuida do refresh e do cache).
 */
export class AgendaGoogle {
  constructor(
    private readonly obterToken: () => Promise<string>,
    readonly calendarId: string,
  ) {}

  private async req<T>(metodo: string, caminho: string, corpo?: unknown, consulta?: Record<string, string>): Promise<T> {
    const url = new URL(`${API}${caminho}`);
    for (const [k, v] of Object.entries(consulta ?? {})) url.searchParams.set(k, v);
    const r = await chamar(url.toString(), {
      method: metodo,
      headers: {
        Authorization: `Bearer ${await this.obterToken()}`,
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if (!r.ok) throw new GoogleApiError(r.status, await motivoDoErro(r));
    if (r.status === 204) return undefined as T;
    return r.json() as Promise<T>;
  }

  private get cal() { return `/calendars/${encodeURIComponent(this.calendarId)}`; }

  /** E-mail da conta (id do calendário primário). Não exige escopo extra. */
  async emailDaConta(): Promise<string> {
    const r = await this.req<{ id: string }>('GET', '/users/me/calendarList/primary');
    return r.id.toLowerCase();
  }

  /**
   * FreeBusy. Já ignora eventos marcados como "Disponível"
   * (transparency=transparent) — filtrar de novo esconderia compromisso.
   */
  async ocupados(de: Date, ate: Date, timeZone: string): Promise<{ start: string; end: string }[]> {
    const r = await this.req<{ calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: { reason: string }[] }> }>(
      'POST', '/freeBusy', {
        timeMin: de.toISOString(), timeMax: ate.toISOString(), timeZone,
        items: [{ id: this.calendarId }],
      });
    const cal = r.calendars?.[this.calendarId];
    if (cal?.errors?.length) throw new GoogleApiError(502, cal.errors[0]!.reason);
    return cal?.busy ?? [];
  }

  /** `sendUpdates=none`: o convite do Google duplicaria o NOSSO e-mail. */
  inserirEvento(id: string, corpo: CorpoEvento) {
    return this.req<EventoGoogle>('POST', `${this.cal}/events`, { id, ...corpo }, { sendUpdates: 'none' });
  }

  atualizarEvento(id: string, corpo: CorpoEvento) {
    return this.req<EventoGoogle>('PATCH', `${this.cal}/events/${encodeURIComponent(id)}`, corpo, { sendUpdates: 'none' });
  }

  apagarEvento(id: string) {
    return this.req<void>('DELETE', `${this.cal}/events/${encodeURIComponent(id)}`, undefined, { sendUpdates: 'none' });
  }

  /**
   * Uma página de eventos. Com `syncToken`, só o que mudou (inclui apagados).
   * 410 → o token expirou: o chamador refaz a sincronização completa.
   */
  listarEventos(p: { syncToken?: string; pageToken?: string }) {
    const q: Record<string, string> = { maxResults: '2500', showDeleted: 'true' };
    if (p.syncToken) q.syncToken = p.syncToken;
    if (p.pageToken) q.pageToken = p.pageToken;
    return this.req<PaginaEventos>('GET', `${this.cal}/events`, undefined, q);
  }

  /** Canal push. Expira (máx. ~30 dias) — renovado por cron diário. */
  observar(p: { id: string; endereco: string; token: string; expiraEm: Date }) {
    return this.req<{ id: string; resourceId: string; expiration?: string }>('POST', `${this.cal}/events/watch`, {
      id: p.id, type: 'web_hook', address: p.endereco, token: p.token,
      expiration: String(p.expiraEm.getTime()),
    });
  }

  pararCanal(id: string, resourceId: string) {
    return this.req<void>('POST', '/channels/stop', { id, resourceId });
  }
}

/**
 * Id do evento no Google DERIVADO do agendamento (base32hex: 0-9 e a-v).
 * Torna a criação idempotente: se o INSERT deu certo e a gravação no nosso
 * banco falhou, a nova tentativa recebe 409 em vez de duplicar o evento.
 */
export function idEventoGoogle(appointmentId: string): string {
  return `ag${appointmentId.replace(/-/g, '').toLowerCase()}`;
}
