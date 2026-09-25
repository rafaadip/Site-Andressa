/**
 * lib/saude.ts — ramo "banco fora" (sem depender de Postgres) e a lógica de
 * cache de `verificarSaudeEmCache` (TTL de 30 s e "falha não fica em
 * cache"). Os ramos com dado real (agenda conectada/revogada, fila de sync,
 * e-mails falhando) são cobertos contra Postgres real em
 * tests/integration/saude.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const executeMock = vi.fn();
const practitionerIdMock = vi.fn();
const estadoAgendaMock = vi.fn();

vi.mock('@/lib/db', () => ({
  db: () => ({ execute: executeMock }),
  schema: { appointment: {}, notification: {} },
}));
vi.mock('@/lib/agendamento/servico', () => ({ practitionerId: (...a: unknown[]) => practitionerIdMock(...a) }));
vi.mock('@/lib/calendar/freebusy', () => ({ estadoAgenda: (...a: unknown[]) => estadoAgendaMock(...a) }));

const { verificarSaude, verificarSaudeEmCache, _limparCacheSaude } = await import('@/lib/saude');
const { _limparCacheEnv } = await import('@/lib/env');

describe('verificarSaude — banco fora do ar', () => {
  beforeEach(() => {
    executeMock.mockReset(); practitionerIdMock.mockReset(); estadoAgendaMock.mockReset();
    vi.unstubAllEnvs(); _limparCacheEnv();
  });

  it('ping ao banco falha → status "fora", nada mais é consultado', async () => {
    executeMock.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const s = await verificarSaude();
    expect(s).toEqual({
      status: 'fora', banco: false, agenda: 'desconhecida', email: false,
      filaSyncMin: null, syncFalhas: 0, emailsFalhos: 0,
    });
    expect(practitionerIdMock).not.toHaveBeenCalled();
    expect(estadoAgendaMock).not.toHaveBeenCalled();
  });

  it('mesmo com o banco fora, reflete emailConfigurado() (não depende de banco)', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_x'); vi.stubEnv('EMAIL_FROM', 'a@b.com'); _limparCacheEnv();
    executeMock.mockRejectedValue(new Error('down'));
    expect((await verificarSaude()).email).toBe(true);
  });
});

describe('verificarSaudeEmCache', () => {
  beforeEach(() => {
    executeMock.mockReset(); practitionerIdMock.mockReset(); estadoAgendaMock.mockReset();
    _limparCacheSaude();
  });

  it('não repete a checagem dentro de 30 s; repete depois de expirar', async () => {
    executeMock.mockRejectedValue(new Error('down'));   // caminho "fora": mais rápido de verificar
    const t0 = 1_700_000_000_000;

    await verificarSaudeEmCache(t0);
    expect(executeMock).toHaveBeenCalledTimes(1);

    await verificarSaudeEmCache(t0 + 29_000);           // ainda dentro da janela
    expect(executeMock).toHaveBeenCalledTimes(1);

    await verificarSaudeEmCache(t0 + 30_000);           // janela expirou (>=)
    expect(executeMock).toHaveBeenCalledTimes(2);
  });

  it('_limparCacheSaude() força nova checagem mesmo dentro da janela', async () => {
    executeMock.mockRejectedValue(new Error('down'));
    await verificarSaudeEmCache(1000);
    expect(executeMock).toHaveBeenCalledTimes(1);
    _limparCacheSaude();
    await verificarSaudeEmCache(1001);
    expect(executeMock).toHaveBeenCalledTimes(2);
  });

  it('uma falha INESPERADA (a promessa REJEITA) não fica em cache: a próxima chamada tenta de novo', async () => {
    executeMock.mockResolvedValue(undefined);                     // ping ok
    practitionerIdMock.mockRejectedValue(new Error('sem profissional cadastrado'));
    const t0 = 2_000_000;

    await expect(verificarSaudeEmCache(t0)).rejects.toThrow('sem profissional cadastrado');
    expect(practitionerIdMock).toHaveBeenCalledTimes(1);

    // Ainda dentro da janela de 30 s — mas como REJEITOU, não foi cacheada.
    await expect(verificarSaudeEmCache(t0 + 5_000)).rejects.toThrow();
    expect(practitionerIdMock).toHaveBeenCalledTimes(2);
  });
});
