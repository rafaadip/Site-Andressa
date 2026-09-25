/**
 * Regressões da auditoria de segurança (docs/SEGURANCA.md). Cada teste
 * reproduz o ataque confirmado e prova a defesa.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sqlCliente } from '@/lib/db';
import { dataLocal, horaLocalParaUtc, somarDiasLocal } from '@/lib/datetime';
import {
  criarAgendamento, disponibilidade, LimiteExcedidoError, LIMITES,
} from '@/lib/agendamento/servico';
import type { CriarAgendamento } from '@/lib/validation/agendamento';
import { inserirConsulta, limparBanco } from '../setup/fabrica';

const d = process.env.DATABASE_URL_TEST ? describe : describe.skip;

d('SEC-01: limites anti-abuso sob concorrência', () => {
  const sql = () => sqlCliente();
  beforeEach(async () => { await limparBanco(sql()); });
  afterAll(async () => { await limparBanco(sql()); });

  async function slotsLivres(n: number) {
    const de = somarDiasLocal(dataLocal(new Date()), 3);
    const r = await disponibilidade({ tipo: 'consulta-presencial', de, ate: somarDiasLocal(de, 20) });
    const slots = r.dias.flatMap((x) => x.slots.map((s) => s.inicio)).slice(0, n);
    expect(slots).toHaveLength(n);
    return slots;
  }
  const pedido = (inicio: string, email: string): CriarAgendamento => ({
    tipo: 'consulta-presencial', inicio,
    paciente: { nome: 'Corrida Teste', telefone: '+5511912345678', email, motivo: '', consentimentoDados: true, consentimentoSaude: false },
  });
  const contar = (r: PromiseSettledResult<unknown>[]) => ({
    criadas: r.filter((x) => x.status === 'fulfilled').length,
    porLimite: r.filter((x) => x.status === 'rejected' && x.reason instanceof LimiteExcedidoError).length,
  });

  it('12 simultâneas, mesmo e-mail canônico, slots diferentes → exatamente o limite por e-mail', async () => {
    const slots = await slotsLivres(12);
    const r = await Promise.allSettled(slots.map((inicio, i) =>
      criarAgendamento(pedido(inicio, `ana+${i}@gmail.com`), { ip: `198.51.100.${i}`, idempotencyKey: randomUUID() })));
    expect(contar(r)).toEqual({ criadas: LIMITES.futurasPorEmail, porLimite: 12 - LIMITES.futurasPorEmail });
  });

  it('12 simultâneas do mesmo IP, e-mails diferentes → exatamente o limite por IP', async () => {
    const slots = await slotsLivres(12);
    const r = await Promise.allSettled(slots.map((inicio, i) =>
      criarAgendamento(pedido(inicio, `p${i}@exemplo.com`), { ip: '203.0.113.99', idempotencyKey: randomUUID() })));
    expect(contar(r)).toEqual({ criadas: LIMITES.porIpPorHora, porLimite: 12 - LIMITES.porIpPorHora });
  });

  it('limite global por hora: depois de N criações na última hora, recusa qualquer origem', async () => {
    const ontem = somarDiasLocal(dataLocal(new Date()), -1);
    for (let i = 0; i < LIMITES.porHoraNoTotal; i++) {
      const hora = `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`;
      // Consultas passadas, sem sobreposição: só o created_at importa aqui.
      await inserirConsulta(sql(), { inicio: horaLocalParaUtc(i < 48 ? ontem : somarDiasLocal(ontem, -1), hora), status: 'completed' });
    }
    const [slot] = await slotsLivres(1);
    await expect(criarAgendamento(pedido(slot!, 'nova@exemplo.com'), { ip: '192.0.2.200', idempotencyKey: randomUUID() }))
      .rejects.toBeInstanceOf(LimiteExcedidoError);
  });
});
