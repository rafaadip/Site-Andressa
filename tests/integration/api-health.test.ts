/**
 * GET /api/health contra Postgres REAL (FASE-13 §5, SEC-14).
 *
 * Público: só `{ status }` — nada de contagem, nada de estado de agenda
 * (isso já dizia quando a agenda tinha caído). Com o Bearer do cron: o
 * detalhe completo.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';
import { sqlCliente } from '@/lib/db';
import { _limparCacheEnv } from '@/lib/env';
import { _limparCacheSaude } from '@/lib/saude';
import { limparBanco } from '../setup/fabrica';

const { GET } = await import('@/app/api/health/route');

const d = process.env.DATABASE_URL_TEST ? describe : describe.skip;
const CRON_SECRET = 'segredo-do-cron-de-teste-16+';

d('GET /api/health', () => {
  const sql = () => sqlCliente();
  beforeEach(async () => { await limparBanco(sql()); _limparCacheSaude(); vi.stubEnv('CRON_SECRET', CRON_SECRET); _limparCacheEnv(); });
  afterEach(() => { vi.unstubAllEnvs(); _limparCacheEnv(); });

  const req = (auth?: string) => new Request('http://localhost/api/health', { headers: auth ? { authorization: auth } : {} });

  it('sem Authorization: só { status }, nada de banco/agenda/e-mail', async () => {
    const r = await GET(req());
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(Object.keys(corpo)).toEqual(['status']);
    expect(['ok', 'degradado', 'fora']).toContain(corpo.status);
  });

  it('com Bearer do CRON_SECRET: o detalhe completo (banco, agenda, fila, e-mail)', async () => {
    const r = await GET(req(`Bearer ${CRON_SECRET}`));
    expect(r.status).toBe(200);
    const corpo = await r.json();
    expect(corpo).toMatchObject({ status: 'ok', banco: true, agenda: 'sem-google', filaSyncMin: null, syncFalhas: 0, emailsFalhos: 0 });
  });

  it('Bearer errado: continua tratado como público (só status), não 401', async () => {
    const r = await GET(req('Bearer chave-errada'));
    expect(r.status).toBe(200);
    expect(Object.keys(await r.json())).toEqual(['status']);
  });

  it('nunca cacheável e sem indexação', async () => {
    const r = await GET(req());
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(r.headers.get('X-Robots-Tag')).toBe('noindex');
  });
});
