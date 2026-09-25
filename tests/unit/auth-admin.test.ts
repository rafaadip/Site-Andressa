/**
 * lib/auth/admin.ts — guardas do painel (Server Components e Server
 * Actions). `next/headers` e `next/navigation` são mockados: fora de um
 * Route Handler/Server Component real não há cookie jar nem redirecionamento
 * de verdade. O banco também é mockado, para isolar a lógica de sessão da
 * leitura de `sessions_valid_after` (isso é coberto contra Postgres real em
 * tests/integration/admin.test.ts e no E2E do painel).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { _limparCacheEnv } from '@/lib/env';

const cookiesMock = vi.fn();
const redirectMock = vi.fn((url: string) => {
  throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;replace;${url};307;` });
});

vi.mock('next/headers', () => ({ cookies: () => cookiesMock() }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirectMock(url) }));

let sessionsValidAfter: Date | null = null;
vi.mock('@/lib/db', () => ({
  db: () => ({
    select: () => ({ from: () => ({ limit: () => Promise.resolve([{ depois: sessionsValidAfter }]) }) }),
    // encerrarSessoes() não encadeia `.where()`: é um UPDATE de linha única.
    update: () => ({ set: () => { sessionsValidAfter = new Date(); return Promise.resolve(); } }),
  }),
  schema: { practitioner: {} },
}));

const { criarSessao } = await import('@/lib/auth/sessao');
const {
  sessaoAtual, exigirAdmin, exigirAdminAcao, encerrarSessoes, sessaoValidaNoServidor, NaoAutorizadoError,
} = await import('@/lib/auth/admin');

const AUTH_SECRET = 'segredo-de-sessao-de-teste-com-32-caracteres-ou-mais';
const ADMIN_EMAIL = 'dra@exemplo.com';

/** Cookie jar falso com no máximo um cookie: `admin_sessao` (HTTP local). */
function jarCom(valor: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (nome: string) => (nome === 'admin_sessao' && valor ? { value: valor } : undefined),
  });
}

describe('lib/auth/admin', () => {
  beforeEach(() => {
    vi.stubEnv('AUTH_SECRET', AUTH_SECRET);
    vi.stubEnv('ADMIN_EMAIL', ADMIN_EMAIL);
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3100');   // http → cookie `admin_sessao`
    _limparCacheEnv();
    sessionsValidAfter = null;
    redirectMock.mockClear();
  });
  afterEach(() => { vi.unstubAllEnvs(); _limparCacheEnv(); });

  describe('sessaoAtual / sessaoValidaNoServidor', () => {
    it('sem cookie: null', async () => {
      jarCom(undefined);
      expect(await sessaoAtual()).toBeNull();
    });

    it('cookie assinado e dentro do prazo: devolve a sessão', async () => {
      jarCom(criarSessao(ADMIN_EMAIL));
      expect(await sessaoAtual()).toMatchObject({ email: ADMIN_EMAIL });
    });

    it('cookie ADULTERADO: null (a assinatura não bate)', async () => {
      const bom = criarSessao(ADMIN_EMAIL);
      jarCom(`${bom.slice(0, -2)}xx`);
      expect(await sessaoAtual()).toBeNull();
    });

    it('"Sair" DEPOIS de emitir o cookie invalida a sessão, mesmo com assinatura e prazo ok', async () => {
      const emitidoEm = Date.now() - 60_000;
      const token = criarSessao(ADMIN_EMAIL, emitidoEm);
      sessionsValidAfter = new Date(emitidoEm + 30_000);
      jarCom(token);
      expect(await sessaoValidaNoServidor({ email: ADMIN_EMAIL, iat: Math.floor(emitidoEm / 1000), exp: 9e9 })).toBe(false);
      expect(await sessaoAtual()).toBeNull();
    });

    it('cookie emitido DEPOIS do último "Sair" continua válido', async () => {
      sessionsValidAfter = new Date(Date.now() - 60_000);
      jarCom(criarSessao(ADMIN_EMAIL));
      expect(await sessaoAtual()).not.toBeNull();
    });

    it('sem NENHUM "Sair" registrado (sessions_valid_after nulo): qualquer cookie válido passa', async () => {
      sessionsValidAfter = null;
      expect(await sessaoValidaNoServidor({ email: ADMIN_EMAIL, iat: 0, exp: 9e9 })).toBe(true);
    });
  });

  describe('exigirAdmin (páginas)', () => {
    it('com sessão válida: devolve a sessão, sem redirecionar', async () => {
      jarCom(criarSessao(ADMIN_EMAIL));
      const s = await exigirAdmin();
      expect(s.email).toBe(ADMIN_EMAIL);
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it('sem sessão: chama redirect("/admin/entrar") — e propaga o "corte" do redirect', async () => {
      jarCom(undefined);
      await expect(exigirAdmin()).rejects.toThrow();
      expect(redirectMock).toHaveBeenCalledTimes(1);
      expect(redirectMock).toHaveBeenCalledWith('/admin/entrar');
    });
  });

  describe('exigirAdminAcao (Server Actions)', () => {
    it('com sessão válida: devolve a sessão', async () => {
      jarCom(criarSessao(ADMIN_EMAIL));
      const s = await exigirAdminAcao();
      expect(s.email).toBe(ADMIN_EMAIL);
    });

    it('sem sessão: lança NaoAutorizadoError (a UI mostra "entre de novo") — NUNCA redireciona', async () => {
      jarCom(undefined);
      await expect(exigirAdminAcao()).rejects.toBeInstanceOf(NaoAutorizadoError);
      expect(redirectMock).not.toHaveBeenCalled();
    });
  });

  describe('encerrarSessoes', () => {
    it('"Sair": o cookie que era válido agora não abre mais nada', async () => {
      const token = criarSessao(ADMIN_EMAIL, Date.now() - 5_000);
      jarCom(token);
      expect(await sessaoAtual()).not.toBeNull();

      await encerrarSessoes();
      expect(await sessaoAtual()).toBeNull();
    });
  });
});
