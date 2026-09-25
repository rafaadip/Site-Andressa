/**
 * Google Calendar e Resend FALSOS, em memória, atrás de um `fetch` falso.
 *
 * Implementam só o que o site usa, com a semântica que importa:
 *   - eventos com id do cliente (409 se repetir), PATCH/DELETE (404/410);
 *   - FreeBusy que enxerga compromissos pessoais E os nossos eventos;
 *   - sync incremental por `syncToken` (delta + apagados só com id) e 410
 *     quando o token "expira";
 *   - refresh token revogado → `invalid_grant`;
 *   - falhas programáveis (503, cota) por endpoint.
 *
 * Os formatos seguem a documentação pública da Calendar API v3 e da Resend.
 */
import { vi } from 'vitest';

type Horario = { dateTime: string; timeZone?: string };
type Evento = {
  id: string; status: 'confirmed' | 'cancelled';
  summary?: string; description?: string; location?: string;
  start: Horario; end: Horario;
  extendedProperties?: { private?: Record<string, string> };
  versao: number;
};

export class GoogleFalso {
  email = 'agenda-teste@exemplo.com';
  calendarId = 'primary';
  eventos = new Map<string, Evento>();
  pessoais: { start: string; end: string }[] = [];
  versao = 0;
  /** syncTokens abaixo disto "expiraram" (410). */
  tokenMinimo = 0;
  revogado = false;
  canais: { id: string; resourceId: string; parado: boolean }[] = [];
  chamadas: { metodo: string; caminho: string }[] = [];
  /** Falha programada: endpoint → status (consumida a cada uso se `vezes`). */
  falhas = new Map<string, { status: number; motivo: string; vezes: number }>();
  escopoConcedido = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly';

  falhar(endpoint: 'freebusy' | 'insert' | 'patch' | 'delete' | 'list' | 'watch', status = 503, vezes = Infinity, motivo = 'backendError') {
    this.falhas.set(endpoint, { status, motivo, vezes });
  }
  curar() { this.falhas.clear(); }

  private falha(endpoint: string): Response | null {
    const f = this.falhas.get(endpoint);
    if (!f || f.vezes <= 0) return null;
    f.vezes--;
    return json({ error: { code: f.status, errors: [{ reason: f.motivo }] } }, f.status);
  }

  // ── Ações da médica no celular ──────────────────────────────────────
  apagarPelaMedica(id: string) {
    const ev = this.eventos.get(id);
    if (!ev) throw new Error(`evento ${id} não existe`);
    ev.status = 'cancelled';
    ev.versao = ++this.versao;
  }
  moverPelaMedica(id: string, inicio: Date, fim: Date) {
    const ev = this.eventos.get(id);
    if (!ev) throw new Error(`evento ${id} não existe`);
    ev.start = { dateTime: inicio.toISOString() };
    ev.end = { dateTime: fim.toISOString() };
    ev.versao = ++this.versao;
  }
  eventoPessoal(inicio: Date, fim: Date) {
    this.pessoais.push({ start: inicio.toISOString(), end: fim.toISOString() });
    const id = `pessoal${this.versao}x${Math.random().toString(36).slice(2, 8)}`;
    this.eventos.set(id, { id, status: 'confirmed', start: { dateTime: inicio.toISOString() }, end: { dateTime: fim.toISOString() }, versao: ++this.versao });
  }
  expirarSyncTokens() { this.tokenMinimo = this.versao + 1; }
  ativos() { return [...this.eventos.values()].filter((e) => e.status === 'confirmed' && e.extendedProperties?.private?.appointmentId); }

  async atender(url: URL, init: RequestInit): Promise<Response> {
    const metodo = (init.method ?? 'GET').toUpperCase();
    const corpoTexto = typeof init.body === 'string' ? init.body : init.body instanceof URLSearchParams ? init.body.toString() : '';
    this.chamadas.push({ metodo, caminho: url.pathname });

    // OAuth
    if (url.host === 'oauth2.googleapis.com') {
      if (url.pathname === '/revoke') { this.revogado = true; return new Response(null, { status: 200 }); }
      const p = new URLSearchParams(corpoTexto);
      if (p.get('grant_type') === 'refresh_token') {
        if (this.revogado) return json({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, 400);
        return json({ access_token: `at-${this.versao}`, expires_in: 3599, scope: this.escopoConcedido, token_type: 'Bearer' });
      }
      return json({ access_token: 'at-inicial', expires_in: 3599, refresh_token: 'rt-segredo-do-google', scope: this.escopoConcedido, token_type: 'Bearer' });
    }

    const cal = `/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}`;
    const caminho = url.pathname;

    if (caminho === '/calendar/v3/users/me/calendarList/primary') return json({ id: this.email, primary: true });

    if (caminho === '/calendar/v3/freeBusy' && metodo === 'POST') {
      const f = this.falha('freebusy'); if (f) return f;
      const q = JSON.parse(corpoTexto) as { timeMin: string; timeMax: string };
      const min = new Date(q.timeMin); const max = new Date(q.timeMax);
      const busy = [
        ...this.pessoais,
        ...this.ativos().map((e) => ({ start: e.start.dateTime, end: e.end.dateTime })),
      ].filter((b) => new Date(b.start) < max && new Date(b.end) > min);
      return json({ kind: 'calendar#freeBusy', calendars: { [this.calendarId]: { busy } } });
    }

    if (caminho === '/calendar/v3/channels/stop') {
      const c = JSON.parse(corpoTexto) as { id: string };
      const canal = this.canais.find((x) => x.id === c.id);
      if (canal) canal.parado = true;
      return new Response(null, { status: 204 });
    }

    if (caminho === `${cal}/events/watch` && metodo === 'POST') {
      const f = this.falha('watch'); if (f) return f;
      const c = JSON.parse(corpoTexto) as { id: string; expiration: string };
      const resourceId = `res-${this.canais.length + 1}`;
      this.canais.push({ id: c.id, resourceId, parado: false });
      return json({ kind: 'api#channel', id: c.id, resourceId, expiration: c.expiration });
    }

    if (caminho === `${cal}/events` && metodo === 'POST') {
      const f = this.falha('insert'); if (f) return f;
      const e = JSON.parse(corpoTexto) as Omit<Evento, 'versao' | 'status'>;
      if (this.eventos.has(e.id)) return json({ error: { code: 409, errors: [{ reason: 'duplicate' }] } }, 409);
      const ev: Evento = { ...e, status: 'confirmed', versao: ++this.versao };
      this.eventos.set(e.id, ev);
      return json(ev);
    }

    if (caminho === `${cal}/events` && metodo === 'GET') {
      const f = this.falha('list'); if (f) return f;
      const token = url.searchParams.get('syncToken');
      let desde = 0;
      if (token) {
        desde = Number(token.replace('st-', ''));
        if (desde < this.tokenMinimo) return json({ error: { code: 410, errors: [{ reason: 'fullSyncRequired' }] } }, 410);
      }
      const itens = [...this.eventos.values()]
        .filter((e) => (token ? e.versao > desde : e.status === 'confirmed' || url.searchParams.get('showDeleted') === 'true'))
        // Apagado volta só com id e status — como no Google real.
        .map((e) => (e.status === 'cancelled' ? { id: e.id, status: 'cancelled' } : e));
      return json({ kind: 'calendar#events', items: itens, nextSyncToken: `st-${this.versao}` });
    }

    const m = caminho.match(new RegExp(`^${cal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/events/([^/]+)$`));
    if (m) {
      const id = decodeURIComponent(m[1]!);
      const ev = this.eventos.get(id);
      if (metodo === 'PATCH') {
        const f = this.falha('patch'); if (f) return f;
        if (!ev) return json({ error: { code: 404, errors: [{ reason: 'notFound' }] } }, 404);
        Object.assign(ev, JSON.parse(corpoTexto), { versao: ++this.versao });
        return json(ev);
      }
      if (metodo === 'DELETE') {
        const f = this.falha('delete'); if (f) return f;
        if (!ev) return json({ error: { code: 404, errors: [{ reason: 'notFound' }] } }, 404);
        if (ev.status === 'cancelled') return json({ error: { code: 410, errors: [{ reason: 'deleted' }] } }, 410);
        ev.status = 'cancelled'; ev.versao = ++this.versao;
        return new Response(null, { status: 204 });
      }
    }
    return json({ error: { code: 404, errors: [{ reason: 'notFound' }] } }, 404);
  }
}

export type EmailEnviado = {
  from: string; to: string[]; subject: string; html: string; text: string;
  reply_to?: string; headers?: Record<string, string>;
  attachments?: { filename: string; content: string; content_type: string }[];
  idempotencia: string | null;
};

export class ResendFalso {
  enviados: EmailEnviado[] = [];
  falharCom: number | null = null;
  private vistos = new Map<string, string>();

  para(email: string) { return this.enviados.filter((e) => e.to.includes(email)); }
  icsDe(e: EmailEnviado) {
    const a = e.attachments?.find((x) => x.filename.endsWith('.ics'));
    return a ? Buffer.from(a.content, 'base64').toString('utf8') : null;
  }

  async atender(_url: URL, init: RequestInit): Promise<Response> {
    if (this.falharCom) return json({ name: 'application_error', message: 'falha simulada' }, this.falharCom);
    const h = new Headers(init.headers);
    const chave = h.get('Idempotency-Key');
    // Idempotência como a da Resend: mesma chave → mesmo id, sem reenviar.
    if (chave && this.vistos.has(chave)) return json({ id: this.vistos.get(chave) });
    const corpo = JSON.parse(String(init.body)) as Omit<EmailEnviado, 'idempotencia'>;
    const id = `email-${this.enviados.length + 1}`;
    this.enviados.push({ ...corpo, idempotencia: chave });
    if (chave) this.vistos.set(chave, id);
    return json({ id });
  }
}

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Instala o fetch falso. Chamadas para outros hosts falham alto. */
export function instalarServicosFalsos() {
  const google = new GoogleFalso();
  const resend = new ResendFalso();
  const fetchFalso = vi.fn(async (entrada: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
    if (url.host === 'oauth2.googleapis.com' || url.host === 'www.googleapis.com') return google.atender(url, init);
    if (url.host === 'api.resend.com') return resend.atender(url, init);
    throw new Error(`fetch inesperado em teste: ${url.host}`);
  });
  vi.stubGlobal('fetch', fetchFalso);
  return { google, resend, fetchFalso };
}

/** Ambiente com Google e Resend "configurados" para os testes. */
export const ENV_INTEGRACOES = {
  GOOGLE_CLIENT_ID: 'cliente-teste.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'segredo-teste',
  GOOGLE_CALENDAR_ID: 'primary',
  GOOGLE_WEBHOOK_TOKEN: 'token-do-webhook-com-16+',
  ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  RESEND_API_KEY: 're_teste',
  EMAIL_FROM: 'Dra. Andressa Correia <contato@exemplo.com.br>',
  ADMIN_EMAIL: 'agenda-teste@exemplo.com',
  AUTH_SECRET: 'segredo-de-sessao-de-teste-com-32-caracteres-ou-mais',
  CRON_SECRET: 'segredo-do-cron-de-teste',
} as const;
