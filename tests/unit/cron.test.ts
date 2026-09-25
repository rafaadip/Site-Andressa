/**
 * lib/api/cron.ts — autorização das rotas de cron e o envelope `executarCron`
 * (401 sem Bearer, 200 com resultado, 500 sem vazar o erro interno).
 *
 * `autorizadoCron` (tempo constante, fechado sem segredo) já tem cobertura
 * básica em tests/unit/seguranca-painel.test.ts; aqui cobrimos os detalhes
 * do comparador (tamanhos diferentes, prefixo, maiúsculas) e o `executarCron`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { autorizadoCron, executarCron } from '@/lib/api/cron';

const req = (auth?: string) => new Request('http://x/api/cron/a', { headers: auth !== undefined ? { authorization: auth } : {} });

describe('autorizadoCron', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('sem CRON_SECRET no ambiente, TODA requisição é recusada — mesmo um Bearer vazio', () => {
    vi.stubEnv('CRON_SECRET', '');
    expect(autorizadoCron(req('Bearer '))).toBe(false);
    expect(autorizadoCron(req())).toBe(false);
  });

  it('CRON_SECRET curto demais (< 16) não é aceito como segredo válido', () => {
    vi.stubEnv('CRON_SECRET', 'curto');
    expect(autorizadoCron(req('Bearer curto'))).toBe(false);
  });

  it('exige o cabeçalho EXATO: prefixo certo, maiúsculas e tamanho não bastam', () => {
    vi.stubEnv('CRON_SECRET', 'segredo-do-cron-16+');
    expect(autorizadoCron(req('Bearer segredo-do-cron-16+'))).toBe(true);
    expect(autorizadoCron(req('bearer segredo-do-cron-16+'))).toBe(false);        // case do esquema
    expect(autorizadoCron(req('Bearersegredo-do-cron-16+'))).toBe(false);         // sem espaço
    expect(autorizadoCron(req('Bearer SEGREDO-DO-CRON-16+'))).toBe(false);        // maiúsculas
    expect(autorizadoCron(req(undefined))).toBe(false);                          // sem cabeçalho algum
  });
});

describe('executarCron', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('sem Bearer válido → 401, e o job NUNCA roda', async () => {
    vi.stubEnv('CRON_SECRET', 'segredo-do-cron-16+');
    const job = vi.fn();
    const r = await executarCron(req(), 'teste', job);
    expect(r.status).toBe(401);
    expect(job).not.toHaveBeenCalled();
  });

  it('autorizado e o job dá certo → 200 com o resultado', async () => {
    vi.stubEnv('CRON_SECRET', 'segredo-do-cron-16+');
    const job = vi.fn().mockResolvedValue({ enviados: 3 });
    const r = await executarCron(req('Bearer segredo-do-cron-16+'), 'teste', job);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, resultado: { enviados: 3 } });
    expect(r.headers.get('Cache-Control')).toBe('no-store');
  });

  it('job lança → 500, SEM vazar a mensagem do erro interno no corpo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('CRON_SECRET', 'segredo-do-cron-16+');
    const job = vi.fn().mockRejectedValue(new Error('DATABASE_URL=postgres://user:senha@host/db'));
    const r = await executarCron(req('Bearer segredo-do-cron-16+'), 'teste', job);
    expect(r.status).toBe(500);
    const corpo = await r.text();
    expect(corpo).not.toContain('senha');
    expect(JSON.parse(corpo)).toEqual({ ok: false });
  });
});
