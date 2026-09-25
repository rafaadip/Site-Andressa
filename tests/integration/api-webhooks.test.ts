/**
 * app/api/webhooks/{google,resend}/route.ts contra Postgres REAL.
 * Sem segredo configurado → 404 (nunca revela se a rota existe); com
 * segredo mas assinatura/token errado → 401.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { sqlCliente } from '@/lib/db';
import { _limparCacheEnv } from '@/lib/env';
import { practitionerId } from '@/lib/agendamento/servico';
import { salvarConexao, _limparTokens } from '@/lib/calendar/conexao';
import { ENV_INTEGRACOES } from '../setup/servicos-falsos';
import { limparBanco } from '../setup/fabrica';

vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: vi.fn() }));

const { POST: googleWebhook } = await import('@/app/api/webhooks/google/route');
const { POST: resendWebhook } = await import('@/app/api/webhooks/resend/route');

const d = process.env.DATABASE_URL_TEST ? describe : describe.skip;

d('webhooks', () => {
  const sql = () => sqlCliente();
  beforeEach(async () => { await limparBanco(sql()); await sql()`DELETE FROM calendar_connection`; _limparTokens(); });
  afterEach(() => { vi.unstubAllEnvs(); _limparCacheEnv(); });

  describe('POST /api/webhooks/google', () => {
    const req = (headers: Record<string, string> = {}) => new Request('http://localhost/api/webhooks/google', { method: 'POST', headers });

    it('Google não configurado (sem GOOGLE_CLIENT_ID/SECRET) → 404', async () => {
      const r = await googleWebhook(req());
      expect(r.status).toBe(404);
    });

    it('configurado, mas token do canal errado → 401', async () => {
      vi.stubEnv('GOOGLE_CLIENT_ID', ENV_INTEGRACOES.GOOGLE_CLIENT_ID);
      vi.stubEnv('GOOGLE_CLIENT_SECRET', ENV_INTEGRACOES.GOOGLE_CLIENT_SECRET);
      vi.stubEnv('GOOGLE_WEBHOOK_TOKEN', ENV_INTEGRACOES.GOOGLE_WEBHOOK_TOKEN);
      vi.stubEnv('GOOGLE_CALENDAR_ID', 'primary');
      vi.stubEnv('ENCRYPTION_KEY', ENV_INTEGRACOES.ENCRYPTION_KEY);
      _limparCacheEnv();
      const r = await googleWebhook(req({ 'x-goog-channel-token': 'token-errado' }));
      expect(r.status).toBe(401);
    });

    it('token certo mas SEM canal registrado (nunca conectou) → 404', async () => {
      for (const k of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_WEBHOOK_TOKEN', 'ENCRYPTION_KEY'] as const) {
        vi.stubEnv(k, ENV_INTEGRACOES[k]);
      }
      _limparCacheEnv();
      const r = await googleWebhook(req({
        'x-goog-channel-token': ENV_INTEGRACOES.GOOGLE_WEBHOOK_TOKEN,
        'x-goog-channel-id': 'canal-qualquer', 'x-goog-resource-id': 'res-qualquer',
      }));
      expect(r.status).toBe(404);
    });

    it('canal e recurso batendo com a conexão ativa → 200 (handshake "sync")', async () => {
      for (const k of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_WEBHOOK_TOKEN', 'ENCRYPTION_KEY'] as const) {
        vi.stubEnv(k, ENV_INTEGRACOES[k]);
      }
      _limparCacheEnv();
      const pid = await practitionerId();
      await salvarConexao({ practitionerId: pid, emailConta: 'agenda-teste@exemplo.com', refreshToken: 'rt-teste' });
      await sql()`UPDATE calendar_connection SET channel_id = 'canal-1', channel_resource_id = 'res-1' WHERE practitioner_id = ${pid}`;

      const r = await googleWebhook(req({
        'x-goog-channel-token': ENV_INTEGRACOES.GOOGLE_WEBHOOK_TOKEN,
        'x-goog-channel-id': 'canal-1', 'x-goog-resource-id': 'res-1', 'x-goog-resource-state': 'sync',
      }));
      expect(r.status).toBe(200);
    });

    it('canal antigo (id não bate mais com a conexão) → 404, para o Google desistir dele', async () => {
      for (const k of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_WEBHOOK_TOKEN', 'ENCRYPTION_KEY'] as const) {
        vi.stubEnv(k, ENV_INTEGRACOES[k]);
      }
      _limparCacheEnv();
      const pid = await practitionerId();
      await salvarConexao({ practitionerId: pid, emailConta: 'agenda-teste@exemplo.com', refreshToken: 'rt-teste' });
      await sql()`UPDATE calendar_connection SET channel_id = 'canal-atual', channel_resource_id = 'res-atual' WHERE practitioner_id = ${pid}`;

      const r = await googleWebhook(req({
        'x-goog-channel-token': ENV_INTEGRACOES.GOOGLE_WEBHOOK_TOKEN,
        'x-goog-channel-id': 'canal-velho', 'x-goog-resource-id': 'res-velho',
      }));
      expect(r.status).toBe(404);
    });
  });

  describe('POST /api/webhooks/resend', () => {
    const segredoBruto = 'segredo-do-webhook-de-teste';
    const segredo = `whsec_${Buffer.from(segredoBruto).toString('base64')}`;
    const assinar = (id: string, ts: string, corpo: string) =>
      `v1,${createHmac('sha256', Buffer.from(segredoBruto)).update(`${id}.${ts}.${corpo}`).digest('base64')}`;

    function req(corpo: string, headers: Record<string, string> = {}) {
      return new Request('http://localhost/api/webhooks/resend', { method: 'POST', body: corpo, headers });
    }
    function assinado(corpo: string) {
      const id = `msg_${randomUUID()}`;
      const ts = String(Math.floor(Date.now() / 1000));
      return req(corpo, { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': assinar(id, ts, corpo) });
    }

    it('e-mail não configurado (sem RESEND_API_KEY) → 404', async () => {
      const r = await resendWebhook(req('{}'));
      expect(r.status).toBe(404);
    });

    it('e-mail configurado mas SEM RESEND_WEBHOOK_SECRET → 404 (não revela a rota)', async () => {
      vi.stubEnv('RESEND_API_KEY', ENV_INTEGRACOES.RESEND_API_KEY);
      vi.stubEnv('EMAIL_FROM', ENV_INTEGRACOES.EMAIL_FROM);
      _limparCacheEnv();
      const r = await resendWebhook(req('{}'));
      expect(r.status).toBe(404);
    });

    it('segredo configurado, assinatura ERRADA → 401', async () => {
      vi.stubEnv('RESEND_API_KEY', ENV_INTEGRACOES.RESEND_API_KEY);
      vi.stubEnv('EMAIL_FROM', ENV_INTEGRACOES.EMAIL_FROM);
      vi.stubEnv('RESEND_WEBHOOK_SECRET', segredo);
      _limparCacheEnv();
      const r = await resendWebhook(req('{"type":"email.bounced"}', {
        'svix-id': 'msg_1', 'svix-timestamp': String(Math.floor(Date.now() / 1000)), 'svix-signature': 'v1,adulterado',
      }));
      expect(r.status).toBe(401);
    });

    it('sem cabeçalhos de assinatura nenhum → 401 (não 500)', async () => {
      vi.stubEnv('RESEND_API_KEY', ENV_INTEGRACOES.RESEND_API_KEY);
      vi.stubEnv('EMAIL_FROM', ENV_INTEGRACOES.EMAIL_FROM);
      vi.stubEnv('RESEND_WEBHOOK_SECRET', segredo);
      _limparCacheEnv();
      const r = await resendWebhook(req('{"type":"email.bounced"}'));
      expect(r.status).toBe(401);
    });

    it('corpo maior que 64 KB → 413', async () => {
      vi.stubEnv('RESEND_API_KEY', ENV_INTEGRACOES.RESEND_API_KEY);
      vi.stubEnv('EMAIL_FROM', ENV_INTEGRACOES.EMAIL_FROM);
      vi.stubEnv('RESEND_WEBHOOK_SECRET', segredo);
      _limparCacheEnv();
      const r = await resendWebhook(req('x'.repeat(70 * 1024)));
      expect(r.status).toBe(413);
    });

    it('assinatura válida, evento irrelevante (email_id desconhecido) → 204', async () => {
      vi.stubEnv('RESEND_API_KEY', ENV_INTEGRACOES.RESEND_API_KEY);
      vi.stubEnv('EMAIL_FROM', ENV_INTEGRACOES.EMAIL_FROM);
      vi.stubEnv('RESEND_WEBHOOK_SECRET', segredo);
      _limparCacheEnv();
      const corpo = JSON.stringify({ type: 'email.bounced', data: { email_id: 'nao-existe' } });
      const r = await resendWebhook(assinado(corpo));
      expect(r.status).toBe(204);
    });
  });
});
