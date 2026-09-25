/**
 * A fila compara `next_at` (gravado pelo relógio do BANCO, em µs) com um
 * corte. Função e banco são máquinas diferentes em produção (Vercel ×
 * Supabase) — e mesmo na mesma máquina o Date da aplicação só tem ms. Com
 * o corte vindo da aplicação, um e-mail recém-enfileirado podia parecer
 * "do futuro" e não sair (o bounce intermitente do CI).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { db, sqlCliente } from '@/lib/db';
import { _limparCacheEnv } from '@/lib/env';
import { horaLocalParaUtc, somarDiasLocal, dataLocal } from '@/lib/datetime';
import { enfileirar, processarFila } from '@/lib/notificacoes/fila';
import { ENV_INTEGRACOES, instalarServicosFalsos, type ResendFalso } from '../setup/servicos-falsos';
import { inserirConsulta, limparBanco } from '../setup/fabrica';

const d = process.env.DATABASE_URL_TEST ? describe : describe.skip;

d('fila: corte pelo relógio do banco', () => {
  const sql = () => sqlCliente();
  let resend: ResendFalso;

  beforeAll(() => {
    for (const [k, v] of Object.entries(ENV_INTEGRACOES)) if (!k.startsWith('GOOGLE')) vi.stubEnv(k, v);
    _limparCacheEnv();
  });
  afterAll(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); _limparCacheEnv(); await limparBanco(sql()); });
  beforeEach(async () => {
    await limparBanco(sql());
    ({ resend } = instalarServicosFalsos());
  });
  afterEach(() => { vi.useRealTimers(); });

  it('recém-enfileirado sai mesmo com o relógio da aplicação atrás do banco', async () => {
    const { id } = await inserirConsulta(sql(), {
      inicio: horaLocalParaUtc(somarDiasLocal(dataLocal(new Date()), 3), '10:00'), email: 'relogio@exemplo.com',
    });
    await enfileirar(db(), { tipo: 'confirmacao', chave: id, appointmentId: id });   // next_at = now() do banco

    // Só o Date da aplicação fica 1 s atrás (timers reais: o driver precisa deles).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() - 1000));
    const r = await processarFila();
    vi.useRealTimers();

    expect(r.sent).toBe(1);
    expect(resend.para('relogio@exemplo.com')).toHaveLength(1);
  });

  it('com `agora` explícito, o corte continua sendo ele (o backoff futuro não sai antes)', async () => {
    const { id } = await inserirConsulta(sql(), {
      inicio: horaLocalParaUtc(somarDiasLocal(dataLocal(new Date()), 3), '10:00'), email: 'depois@exemplo.com',
    });
    await enfileirar(db(), { tipo: 'confirmacao', chave: id, appointmentId: id, vencimento: new Date(Date.now() + 60 * 60_000) });
    expect((await processarFila({ agora: new Date() })).sent).toBe(0);
    expect((await processarFila({ agora: new Date(Date.now() + 2 * 60 * 60_000) })).sent).toBe(1);
  });
});
