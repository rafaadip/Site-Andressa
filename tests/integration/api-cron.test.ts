/**
 * Rotas app/api/cron/* contra Postgres REAL (FASE-13 §4): sem o Bearer do
 * CRON_SECRET, 401; com ele, 200. Banco recém-migrado/semeado, sem Google
 * nem Resend configurados: cada job precisa se comportar (nada de rede,
 * nada de exceção) sem nenhuma conexão de agenda ativa.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sqlCliente } from '@/lib/db';
import { _limparCacheEnv } from '@/lib/env';
import { limparBanco } from '../setup/fabrica';

const { GET: lembretesD1 } = await import('@/app/api/cron/lembretes-d1/route');
const { GET: lembretesH2 } = await import('@/app/api/cron/lembretes-h2/route');
const { GET: notificacoes } = await import('@/app/api/cron/notificacoes/route');
const { GET: reconciliar } = await import('@/app/api/cron/reconciliar/route');
const { GET: renovarCanal } = await import('@/app/api/cron/renovar-canal/route');
const { GET: retencao } = await import('@/app/api/cron/retencao/route');
const { GET: syncGoogle } = await import('@/app/api/cron/sync-google/route');

const d = process.env.DATABASE_URL_TEST ? describe : describe.skip;
const CRON_SECRET = 'segredo-do-cron-de-teste-16+';

const ROTAS = {
  'lembretes-d1': lembretesD1, 'lembretes-h2': lembretesH2, notificacoes, reconciliar,
  'renovar-canal': renovarCanal, retencao, 'sync-google': syncGoogle,
} as const;

d('rotas de cron (FASE-13 §4)', () => {
  const sql = () => sqlCliente();
  beforeEach(async () => { await limparBanco(sql()); vi.stubEnv('CRON_SECRET', CRON_SECRET); _limparCacheEnv(); });
  afterEach(() => { vi.unstubAllEnvs(); _limparCacheEnv(); });

  const req = (auth?: string) => new Request('http://localhost/api/cron/x', { headers: auth ? { authorization: auth } : {} });

  for (const [nome, handler] of Object.entries(ROTAS)) {
    describe(nome, () => {
      it('sem Authorization → 401', async () => {
        const r = await handler(req());
        expect(r.status).toBe(401);
      });

      it('Bearer errado → 401', async () => {
        const r = await handler(req('Bearer chave-errada'));
        expect(r.status).toBe(401);
      });

      it('com o Bearer certo → 200, e não vaza stack', async () => {
        const r = await handler(req(`Bearer ${CRON_SECRET}`));
        expect(r.status).toBe(200);
        expect(r.headers.get('Cache-Control')).toBe('no-store');
        const corpo = await r.json();
        expect(corpo.ok).toBe(true);
      });
    });
  }

  it('sem CRON_SECRET configurado, TODAS as rotas ficam fechadas mesmo com um Bearer', async () => {
    vi.stubEnv('CRON_SECRET', ''); _limparCacheEnv();
    for (const handler of Object.values(ROTAS)) {
      const r = await handler(req(`Bearer ${CRON_SECRET}`));
      expect(r.status).toBe(401);
    }
  });
});
