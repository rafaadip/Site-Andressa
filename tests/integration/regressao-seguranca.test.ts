/**
 * Regressões da auditoria de segurança (docs/SEGURANCA.md). Cada teste
 * reproduz o ataque confirmado e prova a defesa.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sqlCliente } from '@/lib/db';
import { dataLocal, horaLocalParaUtc, somarDiasLocal } from '@/lib/datetime';
import {
  criarAgendamento, disponibilidade, LimiteExcedidoError, LIMITES, practitionerId, SlotIndisponivelError,
} from '@/lib/agendamento/servico';
import { _limparCacheEnv } from '@/lib/env';
import { _limparTokens } from '@/lib/calendar/conexao';
import { concluirConexaoAgenda } from '@/lib/auth/oauth';
import { receberDaAgenda } from '@/lib/calendar/receber';
import { sincronizarAgendamento } from '@/lib/calendar/sincronizar';
import { idEventoGoogle } from '@/lib/calendar/google';
import { ENV_INTEGRACOES, instalarServicosFalsos, type GoogleFalso } from '../setup/servicos-falsos';
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

d('SEC-04: POST recusado não custa chamada ao Google', () => {
  const sql = () => sqlCliente();
  let google: GoogleFalso;
  let pid: string;

  beforeAll(async () => {
    for (const [k, v] of Object.entries(ENV_INTEGRACOES)) vi.stubEnv(k, v);
    _limparCacheEnv();
    pid = await practitionerId();
  });
  afterAll(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); _limparCacheEnv(); await limparBanco(sql()); });
  beforeEach(async () => {
    await limparBanco(sql());
    ({ google } = instalarServicosFalsos());
    _limparTokens();
    expect((await concluirConexaoAgenda(pid, { access_token: 'a', expires_in: 3599, refresh_token: 'rt', scope: google.escopoConcedido })).ok).toBe(true);
    await receberDaAgenda(pid);
  });
  const freeBusy = () => google.chamadas.filter((c) => c.caminho.endsWith('/freeBusy')).length;
  const pedido = (inicio: string, i: number): CriarAgendamento => ({
    tipo: 'consulta-presencial', inicio,
    paciente: { nome: 'Robo Teste', telefone: '+5511912345678', email: `r${i}@exemplo.com`, motivo: '', consentimentoDados: true, consentimentoSaude: false },
  });

  it('30 POSTs para as 03:00 (nunca ofertado): 30 recusas e 0 FreeBusy', async () => {
    const inicio = horaLocalParaUtc(somarDiasLocal(dataLocal(new Date()), 10), '03:00').toISOString();
    const antes = freeBusy();
    for (let i = 0; i < 30; i++) {
      await expect(criarAgendamento(pedido(inicio, i), { ip: '203.0.113.5', idempotencyKey: randomUUID() }))
        .rejects.toBeInstanceOf(SlotIndisponivelError);
    }
    expect(freeBusy() - antes).toBe(0);
  });

  it('SEC-16: evento com o nosso id mas sem a nossa marca não move a consulta', async () => {
    const de = somarDiasLocal(dataLocal(new Date()), 3);
    const r = await disponibilidade({ tipo: 'consulta-presencial', de, ate: somarDiasLocal(de, 6) });
    const inicio = r.dias.flatMap((x) => x.slots)[0]!.inicio;
    const c = await criarAgendamento(pedido(inicio, 77), { ip: '203.0.113.7', idempotencyKey: randomUUID() });
    await sincronizarAgendamento(c.agendamento.id);
    await receberDaAgenda(pid);

    const id = idEventoGoogle(c.agendamento.id);
    delete google.eventos.get(id)!.extendedProperties;     // a "cópia" sem a marca
    const novo = new Date(new Date(inicio).getTime() + 3 * 3_600_000);
    google.moverPelaMedica(id, novo, new Date(novo.getTime() + 40 * 60_000));
    expect(await receberDaAgenda(pid)).toMatchObject({ remarcados: 0 });
    const [l] = await sql()`SELECT visit_starts_at FROM appointment WHERE id = ${c.agendamento.id}`;
    expect(new Date(l!.visit_starts_at).toISOString()).toBe(new Date(inicio).toISOString());
  });

  it('horário ofertado continua conferido AO VIVO na agenda real', async () => {
    const de = somarDiasLocal(dataLocal(new Date()), 3);
    const r = await disponibilidade({ tipo: 'consulta-presencial', de, ate: somarDiasLocal(de, 6) });
    const antes = freeBusy();
    await criarAgendamento(pedido(r.dias.flatMap((x) => x.slots)[0]!.inicio, 99), { ip: '203.0.113.6', idempotencyKey: randomUUID() });
    expect(freeBusy() - antes).toBe(1);
  });
});
