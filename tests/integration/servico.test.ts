/**
 * Serviço de agendamento contra Postgres REAL (migrado pelo journal e
 * semeado pelo globalSetup). Pula sem DATABASE_URL_TEST.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  listarTipos, disponibilidade, criarAgendamento, buscarPorToken, cancelarPorToken, icsPorToken,
  SlotIndisponivelError, LimiteExcedidoError, IdempotenciaConflitanteError, PrazoCancelamentoError,
  LIMITES,
} from '@/lib/agendamento/servico';
import { sqlCliente } from '@/lib/db';
import { dataLocal } from '@/lib/datetime';
import { somarDias } from '@/lib/datetime-cliente';
import type { CriarAgendamento } from '@/lib/validation/agendamento';

const d = process.env.DATABASE_URL_TEST ? describe : describe.skip;

d('serviço de agendamento', () => {
  const sql = () => sqlCliente();

  beforeEach(async () => {
    await sql()`DELETE FROM notification`;
    await sql()`DELETE FROM audit_log`;
    await sql()`DELETE FROM appointment`;
  });
  afterAll(async () => { await sql().end(); });

  /** Todos os slots ofertados nas próximas duas semanas. */
  async function slotsLivres(tipo = 'consulta-presencial') {
    const hoje = dataLocal(new Date());
    const r = await disponibilidade({ tipo, de: hoje, ate: somarDias(hoje, 13) });
    return r.dias.flatMap((x) => x.slots);
  }

  function pedido(inicio: string, extra: Partial<CriarAgendamento['paciente']> = {}): CriarAgendamento {
    return {
      tipo: 'consulta-presencial',
      inicio,
      paciente: {
        nome: 'Ana Souza', telefone: '+5511912345678', email: `ana.${randomUUID().slice(0, 8)}@exemplo.com`,
        motivo: '', consentimentoDados: true, consentimentoSaude: false, ...extra,
      },
    };
  }
  const ctx = (ip = '203.0.113.1') => ({ ip, idempotencyKey: randomUUID() });

  it('lista os tipos ativos, presencial primeiro', async () => {
    const tipos = await listarTipos();
    expect(tipos.map((t) => t.slug)).toEqual(['consulta-presencial', 'teleconsulta']);
  });

  it('oferta horários nas próximas duas semanas', async () => {
    expect((await slotsLivres()).length).toBeGreaterThan(10);
  });

  it('cria, e o horário deixa de ser ofertado', async () => {
    const [slot] = await slotsLivres();
    const r = await criarAgendamento(pedido(slot!.inicio), ctx());

    expect(r.repetido).toBe(false);
    expect(r.agendamento.inicio).toBe(slot!.inicio);
    expect(r.agendamento.urlGestao).toMatch(/\/consulta\/[A-Za-z0-9_-]{43}$/);
    expect(r.agendamento.urlGoogle).toContain('calendar.google.com');

    const restantes = await slotsLivres();
    expect(restantes.some((s) => s.inicio === slot!.inicio)).toBe(false);
  });

  it('guarda no banco só o HASH do token, nunca o token', async () => {
    const [slot] = await slotsLivres();
    const r = await criarAgendamento(pedido(slot!.inicio), ctx());
    const token = r.agendamento.urlGestao.split('/').pop()!;
    const [linha] = await sql()`SELECT manage_token_hash FROM appointment`;
    expect(linha!.manage_token_hash).not.toBe(token);
    expect(linha!.manage_token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('guarda horário clínico e intervalo bloqueado (com buffer) separados', async () => {
    const [slot] = await slotsLivres();
    await criarAgendamento(pedido(slot!.inicio), ctx());
    const [l] = await sql()`SELECT starts_at, ends_at, visit_starts_at, visit_ends_at FROM appointment`;
    // o driver cru pode devolver string: normaliza
    const min = (a: unknown, b: unknown) =>
      (new Date(b as string).getTime() - new Date(a as string).getTime()) / 60_000;
    expect(min(l!.visit_starts_at, l!.visit_ends_at)).toBe(40);   // consulta
    expect(min(l!.starts_at, l!.ends_at)).toBe(50);               // + 10 de buffer
  });

  describe('idempotência', () => {
    it('mesma chave → mesmo agendamento e MESMO link de gestão', async () => {
      const [slot] = await slotsLivres();
      const c = ctx();
      const p = pedido(slot!.inicio);
      const a = await criarAgendamento(p, c);
      const b = await criarAgendamento(p, c);
      expect(b.repetido).toBe(true);
      expect(b.agendamento.id).toBe(a.agendamento.id);
      expect(b.agendamento.urlGestao).toBe(a.agendamento.urlGestao);
      const [{ n }] = await sql()`SELECT count(*)::int AS n FROM appointment` as [{ n: number }];
      expect(n).toBe(1);
    });

    it('mesma chave com pedido DIFERENTE é recusada', async () => {
      const [s1, s2] = await slotsLivres();
      const c = ctx();
      await criarAgendamento(pedido(s1!.inicio), c);
      await expect(criarAgendamento(pedido(s2!.inicio), c)).rejects.toBeInstanceOf(IdempotenciaConflitanteError);
    });

    it('duas requisições SIMULTÂNEAS com a mesma chave criam uma consulta só', async () => {
      const [slot] = await slotsLivres();
      const c = ctx();
      const p = pedido(slot!.inicio);
      const [a, b] = await Promise.all([criarAgendamento(p, c), criarAgendamento(p, c)]);
      expect(a.agendamento.id).toBe(b.agendamento.id);
      // O perdedor da corrida precisa devolver o link que ABRE a consulta
      // do vencedor — não um token derivado de um id que nunca foi gravado.
      expect(b.agendamento.urlGestao).toBe(a.agendamento.urlGestao);
      for (const r of [a, b]) {
        expect(await buscarPorToken(r.agendamento.urlGestao.split('/').pop()!)).not.toBeNull();
      }
      const [{ n }] = await sql()`SELECT count(*)::int AS n FROM appointment` as [{ n: number }];
      expect(n).toBe(1);
    });
  });

  describe('horário', () => {
    it('recusa horário que não é ofertado (POST forjado às 03:00)', async () => {
      const [slot] = await slotsLivres();
      const madrugada = new Date(slot!.inicio);
      madrugada.setUTCHours(6, 0, 0, 0);   // 03:00 em Brasília
      await expect(criarAgendamento(pedido(madrugada.toISOString()), ctx()))
        .rejects.toBeInstanceOf(SlotIndisponivelError);
    });

    it('recusa horário já ocupado', async () => {
      const [slot] = await slotsLivres();
      await criarAgendamento(pedido(slot!.inicio), ctx());
      await expect(criarAgendamento(pedido(slot!.inicio), ctx('203.0.113.2')))
        .rejects.toBeInstanceOf(SlotIndisponivelError);
    });

    it('10 pacientes no mesmo horário ao mesmo tempo → exatamente 1 consegue', async () => {
      const [slot] = await slotsLivres();
      const r = await Promise.allSettled(Array.from({ length: 10 }, (_, i) =>
        criarAgendamento(pedido(slot!.inicio), ctx(`198.51.100.${i}`))));
      const ok = r.filter((x) => x.status === 'fulfilled');
      const conflito = r.filter((x) => x.status === 'rejected' && x.reason instanceof SlotIndisponivelError);
      expect(ok).toHaveLength(1);
      expect(conflito).toHaveLength(9);
    });
  });

  describe('LGPD', () => {
    it('motivo só é gravado com consentimento de saúde, e nunca vai para a auditoria', async () => {
      const [slot] = await slotsLivres();
      await criarAgendamento(
        pedido(slot!.inicio, { motivo: 'Resultado de exames', consentimentoSaude: true }), ctx());
      const [a] = await sql()`SELECT patient_note, consent_health_at FROM appointment`;
      expect(a!.patient_note).toBe('Resultado de exames');
      expect(a!.consent_health_at).not.toBeNull();

      const auditoria = await sql()`SELECT meta::text AS m FROM audit_log`;
      expect(auditoria.map((x) => x.m).join()).not.toContain('Resultado de exames');
    });

    it('não guarda o IP, só o hash', async () => {
      const [slot] = await slotsLivres();
      await criarAgendamento(pedido(slot!.inicio), ctx('203.0.113.77'));
      const [a] = await sql()`SELECT consent_ip_hash FROM appointment`;
      expect(a!.consent_ip_hash).not.toContain('203.0.113.77');
    });
  });

  describe('limites', () => {
    it(`bloqueia o ${LIMITES.porIpPorHora + 1}º agendamento do mesmo IP em uma hora`, async () => {
      const slots = await slotsLivres();
      for (let i = 0; i < LIMITES.porIpPorHora; i++) {
        await criarAgendamento(pedido(slots[i]!.inicio), ctx('192.0.2.50'));
      }
      await expect(criarAgendamento(pedido(slots[LIMITES.porIpPorHora]!.inicio), ctx('192.0.2.50')))
        .rejects.toBeInstanceOf(LimiteExcedidoError);
    });

    it(`bloqueia a ${LIMITES.futurasPorEmail + 1}ª consulta futura do mesmo e-mail`, async () => {
      const slots = await slotsLivres();
      const email = 'mesma.pessoa@exemplo.com';
      for (let i = 0; i < LIMITES.futurasPorEmail; i++) {
        await criarAgendamento(pedido(slots[i]!.inicio, { email }), ctx(`192.0.2.${60 + i}`));
      }
      await expect(criarAgendamento(pedido(slots[9]!.inicio, { email }), ctx('192.0.2.99')))
        .rejects.toBeInstanceOf(LimiteExcedidoError);
    });
  });

  describe('gestão pelo link', () => {
    /** Cancelar exige 24h de antecedência: usa um horário a 48h+ daqui. */
    async function criarUm() {
      const limite = Date.now() + 48 * 3_600_000;
      const slot = (await slotsLivres()).find((s) => new Date(s.inicio).getTime() > limite);
      const r = await criarAgendamento(pedido(slot!.inicio), ctx());
      return { token: r.agendamento.urlGestao.split('/').pop()!, r };
    }

    it('encontra pelo token; token errado ou malformado não encontra nada', async () => {
      const { token } = await criarUm();
      expect((await buscarPorToken(token))?.linha.status).toBe('confirmed');
      expect(await buscarPorToken('x'.repeat(43))).toBeNull();
      expect(await buscarPorToken("'; DROP TABLE appointment; --")).toBeNull();
    });

    it('cancelar libera o horário, incrementa SEQUENCE e o .ics vira CANCEL com o MESMO UID', async () => {
      const { token, r } = await criarUm();
      const antes = (await icsPorToken(token))!;
      const g = await cancelarPorToken(token);

      expect(g.linha.status).toBe('cancelled');
      expect(g.linha.icsSequence).toBe(1);
      const depois = (await icsPorToken(token))!;
      expect(depois).toContain('METHOD:CANCEL');
      const uid = (ics: string) => ics.match(/^UID:(.+)$/m)?.[1];
      expect(uid(depois)).toBe(uid(antes));

      const livres = await slotsLivres();
      expect(livres.some((s) => s.inicio === r.agendamento.inicio)).toBe(true);
    });

    it('cancelar duas vezes não incrementa de novo (idempotente)', async () => {
      const { token } = await criarUm();
      await cancelarPorToken(token);
      const g = await cancelarPorToken(token);
      expect(g.linha.icsSequence).toBe(1);
    });

    it('a menos de 24h da consulta, não cancela pelo link', async () => {
      const { token, r } = await criarUm();
      const duasHorasAntes = new Date(new Date(r.agendamento.inicio).getTime() - 2 * 3_600_000);
      await expect(cancelarPorToken(token, duasHorasAntes)).rejects.toBeInstanceOf(PrazoCancelamentoError);
    });
  });
});
