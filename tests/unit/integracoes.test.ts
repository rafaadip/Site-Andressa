import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { _limparCacheEnv } from '@/lib/env';
import {
  AgendaGoogle, emailDoIdToken, GoogleApiError, GoogleRevogadoError, idEventoGoogle, renovarAccessToken, urlAutorizacao,
  ESCOPOS_AGENDA,
} from '@/lib/calendar/google';
import { esc, renderizar } from '@/lib/email/layout';
import * as T from '@/lib/email/templates';
import { reportarAoSentry } from '@/lib/observabilidade';

const ENV = { GOOGLE_CLIENT_ID: 'cli.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 's', GOOGLE_WEBHOOK_TOKEN: 'x'.repeat(16), ENCRYPTION_KEY: Buffer.alloc(32).toString('base64') };

describe('cliente Google', () => {
  beforeEach(() => { for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v); _limparCacheEnv(); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); _limparCacheEnv(); });

  it('conexão da agenda: offline, consentimento forçado e EXATAMENTE os dois escopos', () => {
    const u = new URL(urlAutorizacao({ redirectUri: 'https://s/cb', state: 'st', escopos: ESCOPOS_AGENDA, offline: true }));
    expect(u.searchParams.get('access_type')).toBe('offline');
    expect(u.searchParams.get('prompt')).toBe('consent');
    expect(u.searchParams.get('scope')!.split(' ')).toEqual([
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
    ]);
    expect(u.searchParams.get('include_granted_scopes')).toBeNull();   // não soma escopos do login
    expect(u.searchParams.get('state')).toBe('st');
  });

  it('id_token: confere emissor e audiência antes de confiar no e-mail', () => {
    const tok = (p: object) => `x.${Buffer.from(JSON.stringify(p)).toString('base64url')}.y`;
    const base = { iss: 'https://accounts.google.com', aud: ENV.GOOGLE_CLIENT_ID, email: 'Dra@Gmail.com', email_verified: true, exp: Date.now() / 1000 + 60 };
    expect(emailDoIdToken(tok(base))).toEqual({ email: 'dra@gmail.com', verificado: true });
    expect(emailDoIdToken(tok({ ...base, aud: 'outro-app' }))).toBeNull();
    expect(emailDoIdToken(tok({ ...base, iss: 'https://evil.example' }))).toBeNull();
    expect(emailDoIdToken(tok({ ...base, exp: 1 }))).toBeNull();
    expect(emailDoIdToken('lixo')).toBeNull();
  });

  it('invalid_grant vira GoogleRevogadoError; 5xx e cota são transitórios; 403 comum não', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })));
    await expect(renovarAccessToken('rt')).rejects.toBeInstanceOf(GoogleRevogadoError);
    expect(new GoogleApiError(503, 'backendError').transitorio).toBe(true);
    expect(new GoogleApiError(403, 'rateLimitExceeded').transitorio).toBe(true);
    expect(new GoogleApiError(403, 'forbiddenForNonOrganizer').transitorio).toBe(false);
  });

  it('timeout de rede vira erro transitório (status 0), não exceção solta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { const e = new Error('t'); e.name = 'TimeoutError'; throw e; }));
    const cli = new AgendaGoogle(async () => 'at', 'primary');
    const e = await cli.ocupados(new Date(), new Date(), 'America/Sao_Paulo').catch((x) => x);
    expect(e).toBeInstanceOf(GoogleApiError);
    expect(e.transitorio).toBe(true);
  });

  it('inserir evento: id no corpo e SEM convite do Google (sendUpdates=none)', async () => {
    const f = vi.fn(async () => new Response('{"id":"x"}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    await new AgendaGoogle(async () => 'at', 'primary').inserirEvento('ag123', {} as never);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).searchParams.get('sendUpdates')).toBe('none');
    expect(JSON.parse(String(init.body)).id).toBe('ag123');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer at');
  });

  it('id do evento derivado do agendamento, em base32hex (0-9, a-v)', () => {
    const id = idEventoGoogle('3F2A1B4C-0000-4000-8000-00000000ABCD');
    expect(id).toMatch(/^[0-9a-v]{5,1024}$/);
    expect(id).toBe(idEventoGoogle('3f2a1b4c-0000-4000-8000-00000000abcd'));
  });
});

describe('e-mails', () => {
  const ctx: T.CtxConsulta = {
    nome: '<b>Ana</b> Souza', quando: 'segunda-feira, 28 de setembro às 09:00', quandoCurto: 'seg, 28/09 às 09:00',
    tipo: 'Consulta presencial', modalidade: 'in_person', local: 'Consultório em Guarulhos – SP', duracaoMin: 40,
    urlGestao: 'https://s/consulta/tok', urlGoogle: 'https://calendar.google.com/x?a=1&b=2', urlAgendar: 'https://s/agendar',
    urlWhatsApp: 'https://wa.me/55', telehealthUrl: null, mapsUrl: null, podeCancelarPeloLink: true, prazoCancelamentoHoras: 24,
  };

  it('escapa o que vem do paciente (sem HTML injetado no e-mail)', () => {
    const r = renderizar(T.confirmacao(ctx));
    expect(r.html).not.toContain('<b>Ana</b>');
    expect(r.html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
    expect(r.html).toContain('a=1&amp;b=2');
    expect(esc(`"'&<>`)).toBe('&quot;&#39;&amp;&lt;&gt;');
  });

  it('versão texto completa: links, identificação CFM e aviso de urgência', () => {
    const r = renderizar(T.confirmacao(ctx));
    for (const trecho of ['https://s/consulta/tok', 'https://calendar.google.com', 'CRM-SP', '192']) expect(r.texto).toContain(trecho);
    expect(r.assunto).toBe('Consulta confirmada — segunda-feira, 28 de setembro às 09:00');
  });

  it('só oferece o link de cancelar enquanto o prazo permite; depois, o WhatsApp', () => {
    expect(renderizar(T.lembreteD1(ctx)).texto).toContain('Remarcar ou cancelar');
    const tarde = renderizar(T.lembreteD1({ ...ctx, podeCancelarPeloLink: false })).texto;
    expect(tarde).not.toContain('Remarcar ou cancelar');
    expect(tarde).toContain('Avisar pelo WhatsApp');
  });

  it('teleconsulta leva o link da sala quando existe; sem sala, não promete link automático', () => {
    const tele = { ...ctx, modalidade: 'telehealth' as const };
    expect(renderizar(T.lembreteH2({ ...tele, telehealthUrl: 'https://meet/x' })).texto).toContain('https://meet/x');
    expect(renderizar(T.lembreteH2(tele)).texto).toContain('será enviado antes do horário');
  });

  it('nenhum e-mail usa termo vedado pelo CFM', () => {
    const med = { nome: 'Ana', telefone: '+55', email: 'a@b.co', quando: 'x', tipo: 't', local: 'l', comMotivo: true, urlPainel: 'u' };
    const docs = [
      T.confirmacao(ctx), T.cancelamento({ ...ctx, motivo: null, pelaMedica: true }), T.remarcacao({ ...ctx, quandoAnterior: 'x' }),
      T.lembreteD1(ctx), T.lembreteH2(ctx), T.novaConsulta(med), T.cancelamentoParaMedica(med),
      T.alertaAgendaDesconectada({ urlPainel: 'u' }), T.alertaSincronizacao({ urlPainel: 'u', quando: 'x', nome: 'n' }),
    ];
    for (const d of docs) {
      const { html, texto } = renderizar(d);
      expect(`${html}${texto}`).not.toMatch(/especialista|nutr[óo]loga|RQE\s*\d|garantid|R\$\s*\d/i);
    }
  });
});

describe('Sentry sem SDK', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('sem DSN não faz nada', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    await reportarAoSentry('x', new Error('y'));
    expect(f).not.toHaveBeenCalled();
  });

  it('envia o envelope sem dado pessoal na mensagem', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://chave123@o1.ingest.sentry.io/42');
    const f = vi.fn(async () => new Response(null, { status: 200 })); vi.stubGlobal('fetch', f);
    await reportarAoSentry('api.erro', new Error('falhou para ana@gmail.com tel +5511912345678'), { agendamento: 'id-1' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://o1.ingest.sentry.io/api/42/envelope/');
    expect((init.headers as Record<string, string>)['X-Sentry-Auth']).toContain('sentry_key=chave123');
    expect(String(init.body)).not.toMatch(/ana@gmail|912345678/);
    expect(String(init.body)).toContain('[email]');
  });
});
