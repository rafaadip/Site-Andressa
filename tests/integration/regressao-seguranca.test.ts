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
import { encerrarSessoes, sessaoValidaNoServidor } from '@/lib/auth/admin';
import { chaveDosLimites } from '@/lib/db/reservas';
import { anonimizarTitular, bloquear, marcarFalta, OperacaoInvalidaError } from '@/lib/agendamento/admin';
import { revogarMotivoPorToken } from '@/lib/agendamento/servico';
import { reconciliar } from '@/lib/calendar/sincronizar';
import { efeitosDe } from '@/lib/agendamento/efeitos';
import { aplicarRetencao } from '@/lib/lgpd/retencao';
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

d('SEC-10: "Sair" derruba a sessão no servidor', () => {
  const sql = () => sqlCliente();
  afterAll(async () => { await sql()`UPDATE practitioner SET sessions_valid_after = NULL`; });
  const sessao = (iatS: number) => ({ email: 'dra@exemplo.com', iat: iatS, exp: iatS + 3600 });

  it('cookie emitido antes do "Sair" (ex.: copiado) deixa de valer; login novo vale', async () => {
    const agoraS = Math.floor(Date.now() / 1000);
    await sql()`UPDATE practitioner SET sessions_valid_after = NULL`;
    expect(await sessaoValidaNoServidor(sessao(agoraS - 60))).toBe(true);
    await encerrarSessoes();
    expect(await sessaoValidaNoServidor(sessao(agoraS - 60))).toBe(false);
    expect(await sessaoValidaNoServidor(sessao(agoraS + 5))).toBe(true);
  });
});

d('SEC-06: eliminação, retenção e revogação chegam à agenda do Google', () => {
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

  /** Consulta sincronizada que depois "vira passada" (o evento fica como registro). */
  async function consultaPassadaNoGoogle(motivo: string) {
    const dia = somarDiasLocal(dataLocal(new Date()), 3);
    const c = await inserirConsulta(sql(), {
      inicio: horaLocalParaUtc(dia, '10:00'), email: 'titular@exemplo.com', nome: 'Joana Titular', motivo,
    });
    await sql()`UPDATE appointment SET sync_state = 'pending' WHERE id = ${c.id}`;
    expect(await sincronizarAgendamento(c.id)).toBe('synced');
    expect(google.eventos.get(idEventoGoogle(c.id))!.description).toContain('diabetes');
    const d100 = new Date(Date.now() - 100 * 86_400_000).toISOString();
    const d100fim = new Date(Date.now() - 100 * 86_400_000 + 40 * 60_000).toISOString();
    await sql()`UPDATE appointment SET visit_starts_at = ${d100}, visit_ends_at = ${d100fim}, starts_at = ${d100}, ends_at = ${d100fim} WHERE id = ${c.id}`;
    return c;
  }
  const evento = (id: string) => google.eventos.get(idEventoGoogle(id))!;
  const semPii = (id: string) => {
    const ev = evento(id);
    const texto = `${ev.summary} ${ev.description}`;
    expect(texto).not.toMatch(/Joana|titular@exemplo|912345678|diabetes/);
  };

  it('eliminar o titular redige o evento passado (nome, telefone, e-mail, motivo)', async () => {
    const c = await consultaPassadaNoGoogle('diabetes tipo 2');
    const r = await anonimizarTitular('titular@exemplo.com');
    expect(r.redigidas).toEqual([c.id]);
    for (const id of r.redigidas) await efeitosDe(id);
    semPii(c.id);
    expect(evento(c.id).description).toContain('removidos');
  });

  it('a reconciliação também alcança o passado a redigir (se o after() falhar)', async () => {
    const c = await consultaPassadaNoGoogle('diabetes tipo 2');
    await anonimizarTitular('titular@exemplo.com');
    await reconciliar();
    semPii(c.id);
  });

  it('retenção de 90 dias tira o motivo também do evento', async () => {
    const c = await consultaPassadaNoGoogle('diabetes tipo 2');
    expect((await aplicarRetencao()).motivosApagados).toBe(1);
    await reconciliar();
    expect(evento(c.id).description).not.toContain('diabetes');
  });

  it('revogar o motivo de uma consulta com falta tira o motivo do evento', async () => {
    const dia = somarDiasLocal(dataLocal(new Date()), 3);
    const c = await inserirConsulta(sql(), { inicio: horaLocalParaUtc(dia, '10:00'), motivo: 'diabetes tipo 2' });
    await sql()`UPDATE appointment SET sync_state = 'pending' WHERE id = ${c.id}`;
    await sincronizarAgendamento(c.id);
    await marcarFalta(c.id, true, new Date(Date.now() + 4 * 86_400_000));
    await efeitosDe(c.id);
    await revogarMotivoPorToken(c.token);
    await efeitosDe(c.id);
    expect(evento(c.id).description).not.toContain('diabetes');
  });

  it('SEC-17: HTML no motivo não vira link na descrição do evento', async () => {
    const dia = somarDiasLocal(dataLocal(new Date()), 3);
    const c = await inserirConsulta(sql(), { inicio: horaLocalParaUtc(dia, '10:00'), motivo: '<a href="https://golpe.example">confirme aqui</a>' });
    await sql()`UPDATE appointment SET sync_state = 'pending' WHERE id = ${c.id}`;
    await sincronizarAgendamento(c.id);
    expect(evento(c.id).description).not.toMatch(/[<>]/);
  });
});

d('SEC-20: bloqueio e agendamento simultâneos — nunca consulta dentro do bloqueio sem decisão', () => {
  const sql = () => sqlCliente();
  beforeEach(async () => { await limparBanco(sql()); });
  afterAll(async () => { await limparBanco(sql()); });

  it('bloqueio criado com a reserva já em voo: a reserva vê o bloqueio e recusa', async () => {
    const pid = await practitionerId();
    const de = somarDiasLocal(dataLocal(new Date()), 3);
    const r = await disponibilidade({ tipo: 'consulta-presencial', de, ate: somarDiasLocal(de, 6) });
    const slot = r.dias.flatMap((x) => x.slots)[0]!;
    const inicio = new Date(slot.inicio);

    // A médica "bloqueando": segura o lock dos limites numa conexão própria.
    const medica = await sql().reserve();
    await medica`BEGIN`;
    await medica`SELECT pg_advisory_xact_lock(${chaveDosLimites(pid).toString()}::bigint)`;
    const reserva = criarAgendamento({
      tipo: 'consulta-presencial', inicio: slot.inicio,
      paciente: { nome: 'Ana Souza', telefone: '+5511912345678', email: 'voo@exemplo.com', motivo: '', consentimentoDados: true, consentimentoSaude: false },
    }, { ip: '198.18.2.1', idempotencyKey: randomUUID() });
    const resultado = reserva.then(() => 'criada', (e: unknown) => e);
    // Espera a reserva passar da oferta e parar no lock.
    for (let i = 0; i < 200; i++) {
      const [{ n }] = await sql()`SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND NOT granted` as unknown as [{ n: number }];
      if (n > 0) break;
      await new Promise((ok) => setTimeout(ok, 25));
    }
    await medica`INSERT INTO availability_exception (practitioner_id, starts_at, ends_at, kind)
      VALUES (${pid}, ${inicio.toISOString()}, ${new Date(inicio.getTime() + 60 * 60_000).toISOString()}, 'block')`;
    await medica`COMMIT`;
    medica.release();
    expect(await resultado).toBeInstanceOf(SlotIndisponivelError);
  });

  it('em cada corrida, só um dos dois vence', async () => {
    const de = somarDiasLocal(dataLocal(new Date()), 3);
    const r = await disponibilidade({ tipo: 'consulta-presencial', de, ate: somarDiasLocal(de, 13) });
    const slots = r.dias.flatMap((x) => x.slots).slice(0, 8);
    for (const [i, slot] of slots.entries()) {
      const inicio = new Date(slot.inicio);
      const [ag, bl] = await Promise.allSettled([
        criarAgendamento({
          tipo: 'consulta-presencial', inicio: slot.inicio,
          paciente: { nome: 'Ana Souza', telefone: '+5511912345678', email: `b${i}@exemplo.com`, motivo: '', consentimentoDados: true, consentimentoSaude: false },
        }, { ip: `198.18.1.${i}`, idempotencyKey: randomUUID() }),
        bloquear({ inicio, fim: new Date(inicio.getTime() + 40 * 60_000) }),
      ]);
      expect([ag.status, bl.status].sort()).toEqual(['fulfilled', 'rejected']);
      if (bl.status === 'rejected') expect(bl.reason).toBeInstanceOf(OperacaoInvalidaError);
      if (ag.status === 'rejected') expect(ag.reason).toBeInstanceOf(SlotIndisponivelError);
    }
  });
});
