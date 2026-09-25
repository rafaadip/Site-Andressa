/**
 * lib/saude.ts — /api/health (FASE-13 §5) contra Postgres REAL.
 *
 * O ramo "banco fora" (sem Postgres) é coberto por unit (mock de `db()`) em
 * tests/unit/saude.test.ts — aqui, com banco de verdade, cobrimos os
 * critérios que dependem de dados reais: estado da agenda, fila de sync
 * parada e e-mails falhando, e o cache de 30 s de `verificarSaudeEmCache`.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { sqlCliente } from '@/lib/db';
import { _limparCacheEnv } from '@/lib/env';
import { verificarSaude, verificarSaudeEmCache, _limparCacheSaude } from '@/lib/saude';
import { practitionerId } from '@/lib/agendamento/servico';
import { marcarRevogada, _limparTokens } from '@/lib/calendar/conexao';
import { concluirConexaoAgenda } from '@/lib/auth/oauth';
import { ENV_INTEGRACOES, instalarServicosFalsos } from '../setup/servicos-falsos';
import { inserirConsulta, limparBanco } from '../setup/fabrica';

const d = process.env.DATABASE_URL_TEST ? describe : describe.skip;

d('lib/saude (FASE-13 §5)', () => {
  const sql = () => sqlCliente();
  let pid: string;

  beforeEach(async () => {
    await limparBanco(sql());
    _limparCacheSaude();
    pid = await practitionerId();
  });
  afterEach(() => { vi.unstubAllEnvs(); _limparCacheEnv(); });
  afterAll(async () => { await limparBanco(sql()); });

  it('linha de base: banco ok, sem Google configurado, sem e-mail configurado → status ok', async () => {
    const s = await verificarSaude();
    expect(s).toMatchObject({
      status: 'ok', banco: true, agenda: 'sem-google', email: false,
      filaSyncMin: null, syncFalhas: 0, emailsFalhos: 0,
    });
  });

  it('e-mail configurado é refletido mesmo sem nenhuma falha', async () => {
    vi.stubEnv('RESEND_API_KEY', ENV_INTEGRACOES.RESEND_API_KEY);
    vi.stubEnv('EMAIL_FROM', ENV_INTEGRACOES.EMAIL_FROM);
    _limparCacheEnv();
    expect((await verificarSaude()).email).toBe(true);
  });

  describe('estado da agenda', () => {
    it('Google conectado → agenda "conectada", status ok', async () => {
      for (const [k, v] of Object.entries(ENV_INTEGRACOES)) vi.stubEnv(k, v);
      _limparCacheEnv();
      const { google } = instalarServicosFalsos();
      _limparTokens();
      const r = await concluirConexaoAgenda(pid, {
        access_token: 'at', expires_in: 3599, refresh_token: 'rt-google', scope: google.escopoConcedido,
      });
      expect(r.ok).toBe(true);

      const s = await verificarSaude();
      expect(s.agenda).toBe('conectada');
      expect(s.status).toBe('ok');
    });

    it('agenda conectada e depois REVOGADA (invalid_grant) → "revogada" e status degradado (ADR-002)', async () => {
      for (const [k, v] of Object.entries(ENV_INTEGRACOES)) vi.stubEnv(k, v);
      _limparCacheEnv();
      const { google } = instalarServicosFalsos();
      _limparTokens();
      const r = await concluirConexaoAgenda(pid, {
        access_token: 'at', expires_in: 3599, refresh_token: 'rt-google', scope: google.escopoConcedido,
      });
      expect(r.ok).toBe(true);
      const [c] = await sql()`SELECT id FROM calendar_connection WHERE practitioner_id = ${pid}`;
      await marcarRevogada(c!.id, 'invalid_grant');

      const s = await verificarSaude();
      expect(s.agenda).toBe('revogada');
      expect(s.status).toBe('degradado');
    });
  });

  it('5+ consultas futuras com sync falhando → status degradado, syncFalhas reflete a contagem', async () => {
    for (let i = 0; i < 5; i++) {
      const { id } = await inserirConsulta(sql(), { inicio: new Date(Date.now() + (i + 1) * 3_600_000) });
      await sql()`UPDATE appointment SET sync_state = 'failed' WHERE id = ${id}`;
    }
    const s = await verificarSaude();
    expect(s.syncFalhas).toBe(5);
    expect(s.status).toBe('degradado');
  });

  it('consultas PASSADAS com sync pendente não contam (não faz sentido reprocessar o que já foi)', async () => {
    for (let i = 0; i < 5; i++) {
      const { id } = await inserirConsulta(sql(), { inicio: new Date(Date.now() - (i + 1) * 3_600_000) });
      await sql()`UPDATE appointment SET sync_state = 'failed' WHERE id = ${id}`;
    }
    const s = await verificarSaude();
    expect(s.syncFalhas).toBe(0);
    expect(s.status).toBe('ok');
  });

  it('e-mail falhando 5× (esgotado) na última semana → status degradado, emailsFalhos > 0', async () => {
    const { id } = await inserirConsulta(sql(), { inicio: new Date(Date.now() + 3_600_000) });
    await sql()`INSERT INTO notification (dedup_key, appointment_id, kind, recipient, status, attempts)
                 VALUES (${`confirmacao:${id}`}, ${id}, 'confirmacao', 'patient', 'failed', 5)`;
    const s = await verificarSaude();
    expect(s.emailsFalhos).toBe(1);
    expect(s.status).toBe('degradado');
  });

  it('e-mail falhando há mais de 7 dias não conta mais (já foi alertado)', async () => {
    const { id } = await inserirConsulta(sql(), { inicio: new Date(Date.now() + 3_600_000) });
    await sql()`INSERT INTO notification (dedup_key, appointment_id, kind, recipient, status, attempts, created_at)
                 VALUES (${`confirmacao:${id}`}, ${id}, 'confirmacao', 'patient', 'failed', 5, now() - interval '8 days')`;
    const s = await verificarSaude();
    expect(s.emailsFalhos).toBe(0);
    expect(s.status).toBe('ok');
  });

  it('e-mail com menos de 5 tentativas (ainda no backoff, não esgotado) não conta como falha definitiva', async () => {
    const { id } = await inserirConsulta(sql(), { inicio: new Date(Date.now() + 3_600_000) });
    await sql()`INSERT INTO notification (dedup_key, appointment_id, kind, recipient, status, attempts)
                 VALUES (${`confirmacao:${id}`}, ${id}, 'confirmacao', 'patient', 'failed', 2)`;
    const s = await verificarSaude();
    expect(s.emailsFalhos).toBe(0);
  });

  describe('verificarSaudeEmCache', () => {
    it('cacheia por 30 s: uma mudança no banco só aparece depois de expirar (ou de limpar o cache)', async () => {
      const t0 = Date.now();
      const a = await verificarSaudeEmCache(t0);
      expect(a.status).toBe('ok');

      const { id } = await inserirConsulta(sql(), { inicio: new Date(Date.now() + 3_600_000) });
      await sql()`INSERT INTO notification (dedup_key, appointment_id, kind, recipient, status, attempts)
                   VALUES (${`confirmacao:${id}`}, ${id}, 'confirmacao', 'patient', 'failed', 5)`;

      const b = await verificarSaudeEmCache(t0 + 20_000);      // dentro da janela: ainda o resultado velho
      expect(b).toEqual(a);

      const cVal = await verificarSaudeEmCache(t0 + 30_001);   // janela expirou: reflete a mudança
      expect(cVal.status).toBe('degradado');
      expect(cVal.emailsFalhos).toBe(1);
    });

    it('_limparCacheSaude() força reconsulta imediata, mesmo dentro da janela', async () => {
      const t0 = Date.now();
      await verificarSaudeEmCache(t0);
      const { id } = await inserirConsulta(sql(), { inicio: new Date(Date.now() + 3_600_000) });
      await sql()`UPDATE appointment SET sync_state = 'failed' WHERE id = ${id}`;
      _limparCacheSaude();
      const r = await verificarSaudeEmCache(t0 + 1_000);
      expect(r.syncFalhas).toBe(1);
    });
  });
});
