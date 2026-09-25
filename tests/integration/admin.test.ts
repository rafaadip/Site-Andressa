/**
 * Operações do painel (FASE-09) e direitos do titular (FASE-10) contra
 * Postgres REAL. Sem Google e sem Resend: aqui interessa o banco e a fila.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sqlCliente } from '@/lib/db';
import { dataLocal, horaLocalParaUtc, somarDiasLocal } from '@/lib/datetime';
import {
  agenda, afetadosPor, anonimizarTitular, atualizarPoliticas, atualizarTipo, bloquear, cancelarPelaMedica, consultasDoTitular,
  estadoPainel, exportarTitular, listarExcecoes, listarRegras, marcarFalta, OperacaoInvalidaError, paraCsv,
  remarcarPelaMedica, removerExcecao, restoDeHoje, salvarDia, horariosParaRemarcar, periodoDoFormulario,
} from '@/lib/agendamento/admin';
import { buscarPorToken, criarAgendamento, disponibilidade, SlotIndisponivelError } from '@/lib/agendamento/servico';
import type { CriarAgendamento } from '@/lib/validation/agendamento';
import { inserirConsulta, limparBanco, TIPO_PRESENCIAL } from '../setup/fabrica';
import { semear } from '../../scripts/seed';

const d = process.env.DATABASE_URL_TEST ? describe : describe.skip;

d('painel da médica (FASE-09) e LGPD (FASE-10)', () => {
  const sql = () => sqlCliente();
  beforeEach(async () => { await limparBanco(sql()); });
  afterAll(async () => {
    await limparBanco(sql());
    await semear(process.env.DATABASE_URL_TEST!);        // devolve regras e tipos originais
  });

  const hoje = () => dataLocal(new Date());
  async function slots(de = hoje(), dias = 13) {
    const r = await disponibilidade({ tipo: 'consulta-presencial', de, ate: somarDiasLocal(de, dias) });
    return r.dias.flatMap((x) => x.slots);
  }
  async function criar(indice = 0, extra: Partial<CriarAgendamento['paciente']> = {}) {
    const s = (await slots())[indice]!;
    const email = extra.email ?? `ana.${randomUUID().slice(0, 8)}@exemplo.com`;
    const r = await criarAgendamento({
      tipo: 'consulta-presencial', inicio: s.inicio,
      paciente: { nome: 'Ana Souza', telefone: '+5511912345678', email, motivo: '', consentimentoDados: true, consentimentoSaude: false, ...extra },
    }, { ip: `203.0.113.${indice + 20}`, idempotencyKey: randomUUID() });
    return { id: r.agendamento.id, inicio: r.agendamento.inicio, token: r.agendamento.urlGestao.split('/').pop()!, email };
  }
  async function linha(id: string) { return (await sql()`SELECT * FROM appointment WHERE id = ${id}`)[0]!; }
  async function filaDe(id: string) { return (await sql()`SELECT kind FROM notification WHERE appointment_id = ${id} ORDER BY created_at`).map((r) => r.kind); }

  describe('agenda', () => {
    it('lista as consultas ativas de hoje em diante, em ordem', async () => {
      const b = await criar(1);
      const a = await criar(0);
      const itens = await agenda();
      expect(itens.map((i) => i.id)).toEqual([a.id, b.id]);
      expect(itens[0]).toMatchObject({ nome: 'Ana Souza', tipo: 'Consulta presencial', modalidade: 'in_person' });
    });
  });

  describe('cancelar pela médica', () => {
    it('cancela, guarda o recado, sobe a SEQUENCE e avisa o paciente', async () => {
      const c = await criar();
      await cancelarPelaMedica(c.id, { motivo: 'Surgiu um plantão.', avisar: true });
      const l = await linha(c.id);
      expect(l).toMatchObject({ status: 'cancelled', cancelled_by: 'practitioner', cancel_reason: 'Surgiu um plantão.', ics_sequence: 1, sync_state: 'pending' });
      expect(await filaDe(c.id)).toContain('cancelamento');
      // O horário volta a ser ofertado.
      expect((await slots()).some((s) => s.inicio === c.inicio)).toBe(true);
    });

    it('sem "avisar", nenhum e-mail ao paciente é enfileirado', async () => {
      const c = await criar();
      await cancelarPelaMedica(c.id, { avisar: false });
      expect(await filaDe(c.id)).not.toContain('cancelamento');
    });
  });

  describe('falta', () => {
    it('só depois do início, e é reversível', async () => {
      const futura = await criar();
      await expect(marcarFalta(futura.id, true)).rejects.toBeInstanceOf(OperacaoInvalidaError);
      const { id } = await inserirConsulta(sql(), { inicio: new Date(Date.now() - 30 * 60_000) });
      await marcarFalta(id, true);
      expect((await linha(id)).status).toBe('no_show');
      await marcarFalta(id, false);
      expect((await linha(id)).status).toBe('confirmed');
    });
  });

  describe('remarcar', () => {
    it('move para um horário livre: SEQUENCE+1, lembretes zerados e e-mail com o novo horário', async () => {
      const c = await criar(0);
      const alvo = (await slots()).find((s) => s.inicio !== c.inicio)!;
      await remarcarPelaMedica(c.id, alvo.inicio);
      const l = await linha(c.id);
      expect(new Date(l.visit_starts_at).toISOString()).toBe(alvo.inicio);
      expect(l.ics_sequence).toBe(1);
      expect(l.sync_state).toBe('pending');
      expect(await filaDe(c.id)).toContain('remarcacao');
    });

    it('a própria consulta não se bloqueia, e dá para encaixar dentro da antecedência mínima', async () => {
      const c = await criar(0);
      const r = await horariosParaRemarcar(c.id, hoje(), somarDiasLocal(hoje(), 13));
      expect(r.dias.flatMap((x) => x.slots).some((s) => s.inicio === c.inicio)).toBe(true);
    });

    it('recusa horário ocupado ou fora do expediente', async () => {
      const a = await criar(0);
      const b = await criar(1);
      await expect(remarcarPelaMedica(a.id, b.inicio)).rejects.toBeInstanceOf(SlotIndisponivelError);
      const madrugada = horaLocalParaUtc(somarDiasLocal(hoje(), 3), '03:00').toISOString();
      await expect(remarcarPelaMedica(a.id, madrugada)).rejects.toBeInstanceOf(SlotIndisponivelError);
    });
  });

  describe('bloqueios', () => {
    it('bloquear com consulta dentro EXIGE uma decisão por consulta', async () => {
      const c = await criar(0);
      const inicio = new Date(new Date(c.inicio).getTime() - 30 * 60_000);
      const fim = new Date(new Date(c.inicio).getTime() + 90 * 60_000);
      expect((await afetadosPor(inicio, fim)).map((a) => a.id)).toEqual([c.id]);
      await expect(bloquear({ inicio, fim })).rejects.toThrow(/Decida o que fazer/);
      expect(await listarExcecoes()).toHaveLength(0);                    // nada gravado
    });

    it('"manter" preserva a consulta; "cancelar" cancela e avisa; o período some da oferta', async () => {
      const a = await criar(0);
      const b = await criar(1);
      const inicio = new Date(Math.min(+new Date(a.inicio), +new Date(b.inicio)) - 60_000);
      const fim = new Date(Math.max(+new Date(a.inicio), +new Date(b.inicio)) + 60 * 60_000);
      const r = await bloquear({ inicio, fim, nota: 'Congresso', decisoes: { [a.id]: 'manter', [b.id]: 'cancelar' }, motivoAoPaciente: 'Congresso' });
      expect(r.cancelados).toEqual([b.id]);
      expect((await linha(a.id)).status).toBe('confirmed');
      expect((await linha(b.id))).toMatchObject({ status: 'cancelled', cancel_reason: 'Congresso' });
      expect((await slots()).some((s) => new Date(s.inicio) >= inicio && new Date(s.inicio) < fim)).toBe(false);

      const [x] = await listarExcecoes();
      await removerExcecao(x!.id);
      expect(await listarExcecoes()).toHaveLength(0);
    });

    it('"resto de hoje" vai de agora até a meia-noite local', () => {
      const agora = new Date('2026-09-25T18:00:00Z');                  // 15:00 em Brasília
      const r = restoDeHoje(agora);
      expect(r.inicio).toEqual(agora);
      expect(r.fim.toISOString()).toBe('2026-09-26T03:00:00.000Z');
    });

    it('período do formulário: sem hora final vai até a meia-noite do último dia', () => {
      const p = periodoDoFormulario({ de: '2026-10-20', ate: '2026-10-27', diaInteiro: true });
      expect(p.inicio.toISOString()).toBe('2026-10-20T03:00:00.000Z');
      expect(p.fim.toISOString()).toBe('2026-10-28T03:00:00.000Z');
      const q = periodoDoFormulario({ de: '2026-10-20', hi: '08:00', hf: '14:00' });
      expect([q.inicio.toISOString(), q.fim.toISOString()]).toEqual(['2026-10-20T11:00:00.000Z', '2026-10-20T17:00:00.000Z']);
    });
  });

  describe('semana padrão', () => {
    it('substitui as faixas do dia; "as duas" vira uma regra por modalidade', async () => {
      await salvarDia(6, [{ inicio: '09:00', fim: '12:00', modalidade: 'ambas' }]);
      const sabado = (await listarRegras()).filter((r) => r.diaSemana === 6);
      expect(sabado.map((r) => r.modalidade).sort()).toEqual(['in_person', 'telehealth']);
      await salvarDia(6, []);
      expect((await listarRegras()).filter((r) => r.diaSemana === 6)).toHaveLength(0);
    });

    it('recusa faixa invertida, hora malformada e sobreposição na mesma modalidade', async () => {
      await expect(salvarDia(6, [{ inicio: '12:00', fim: '09:00', modalidade: 'in_person' }])).rejects.toThrow(/termina antes/);
      await expect(salvarDia(6, [{ inicio: '9h', fim: '12:00', modalidade: 'in_person' }])).rejects.toThrow(/formato/);
      await expect(salvarDia(6, [
        { inicio: '09:00', fim: '12:00', modalidade: 'in_person' },
        { inicio: '11:00', fim: '13:00', modalidade: 'ambas' },
      ])).rejects.toThrow(/se sobrepõem/);
    });
  });

  describe('configurações', () => {
    it('antecedência e horizonte do painel valem para a oferta', async () => {
      await atualizarPoliticas({ leadTimeHours: 72, horizonDays: 7, cancelDeadlineHours: 48, telehealthUrl: null, includeNoteInEvent: true });
      const lista = await slots(hoje(), 20);
      expect(lista.every((s) => new Date(s.inicio).getTime() >= Date.now() + 72 * 3_600_000)).toBe(true);
      expect(lista.every((s) => new Date(s.inicio).getTime() <= Date.now() + 7 * 86_400_000)).toBe(true);
    });

    it('prazo de cancelamento do painel vale para o link do paciente', async () => {
      const c = await criar(0);
      await atualizarPoliticas({ leadTimeHours: 12, horizonDays: 60, cancelDeadlineHours: 168, telehealthUrl: null, includeNoteInEvent: true });
      expect((await buscarPorToken(c.token))!.podeCancelar).toBe(false);
    });

    it('valida os limites e o link da sala (só https)', async () => {
      await expect(atualizarPoliticas({ leadTimeHours: -1, horizonDays: 60, cancelDeadlineHours: 24, telehealthUrl: null, includeNoteInEvent: true })).rejects.toThrow(/Antecedência/);
      await expect(atualizarPoliticas({ leadTimeHours: 12, horizonDays: 60, cancelDeadlineHours: 24, telehealthUrl: 'http://sala', includeNoteInEvent: true })).rejects.toThrow(/https/);
      await expect(atualizarTipo(TIPO_PRESENCIAL, { label: 'X', durationMin: 40, bufferBeforeMin: 0, bufferAfterMin: 10, isActive: true })).rejects.toThrow(/Nome/);
      await expect(atualizarTipo(TIPO_PRESENCIAL, { label: 'Consulta', durationMin: 5, bufferBeforeMin: 0, bufferAfterMin: 10, isActive: true })).rejects.toThrow(/Duração/);
    });

    it('mudar a duração do tipo não muda o horário de quem já marcou', async () => {
      const c = await criar(0);
      await atualizarTipo(TIPO_PRESENCIAL, { label: 'Consulta presencial', durationMin: 60, bufferBeforeMin: 0, bufferAfterMin: 10, isActive: true });
      const l = await linha(c.id);
      expect((new Date(l.visit_ends_at).getTime() - new Date(l.visit_starts_at).getTime()) / 60_000).toBe(40);
    });
  });

  it('estado do painel conta fila de sincronização e integrações', async () => {
    await criar(0);
    const e = await estadoPainel();
    expect(e.filaSync.pendentes).toBe(1);
    expect(e.google).toBe('nao-configurado');
  });

  describe('LGPD — direitos do titular', () => {
    it('exporta tudo o que existe (JSON e CSV) e registra a exportação', async () => {
      const c = await criar(0, { motivo: 'Exames', consentimentoSaude: true });
      const dados = await exportarTitular(c.email.toUpperCase());
      expect(dados.consultas).toHaveLength(1);
      expect(dados.consultas[0]).toMatchObject({ motivo: 'Exames', versaoConsentimento: expect.any(String) });
      const csv = paraCsv(dados);
      expect(csv.split('\r\n')[0]).toContain('versaoConsentimento');
      expect(csv).toContain('"Exames"');
      const [a] = await sql()`SELECT action FROM audit_log WHERE action = 'data.exported'`;
      expect(a).toBeTruthy();
    });

    it('CSV neutraliza fórmula (injeção no Excel)', () => {
      const csv = paraCsv({ geradoEm: '', titular: '', consultas: [{
        tipo: 't', inicio: '', fim: '', status: '', nome: '=HYPERLINK("http://x")', email: '', telefone: '+55',
        motivo: null, consentimentoDados: '', consentimentoSaude: null, versaoConsentimento: null, criadaEm: '', canceladaEm: null,
      }] });
      expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
      expect(csv).toContain(`"'+55"`);
    });

    it('eliminação anonimiza, cancela as futuras sem e-mail, invalida o link e esvazia a fila', async () => {
      const c = await criar(0, { motivo: 'Exames', consentimentoSaude: true });
      const r = await anonimizarTitular(c.email);
      expect(r).toEqual({ consultas: 1, canceladas: [c.id], redigidas: [] });
      const l = await linha(c.id);
      expect(l).toMatchObject({ patient_name: 'Titular removido', patient_email: '', patient_phone: '', patient_note: null, status: 'cancelled' });
      expect(l.anonymized_at).not.toBeNull();
      expect(await buscarPorToken(c.token)).toBeNull();
      const fila = await sql()`SELECT status FROM notification WHERE appointment_id = ${c.id}`;
      expect(fila.every((n) => n.status === 'skipped')).toBe(true);
      expect(await exportarTitular(c.email)).toMatchObject({ consultas: [] });
    });

    it('e-mail vazio ou inválido é recusado: não "elimina" de novo as linhas já anonimizadas', async () => {
      const c = await criar(0);
      await anonimizarTitular(c.email);
      // Linha anonimizada tem e-mail '': buscar por '' devolvia todas elas.
      await expect(anonimizarTitular('')).rejects.toThrow(OperacaoInvalidaError);
      await expect(anonimizarTitular('   ')).rejects.toThrow(OperacaoInvalidaError);
      await expect(anonimizarTitular('sem-arroba')).rejects.toThrow(OperacaoInvalidaError);
      expect(await consultasDoTitular('')).toEqual([]);
      expect(await exportarTitular('')).toMatchObject({ consultas: [] });
      // Repetir a eliminação do mesmo titular não conta nada de novo.
      expect(await anonimizarTitular(c.email)).toEqual({ consultas: 0, canceladas: [], redigidas: [] });
      const registros = await sql()`SELECT meta FROM audit_log WHERE action = 'data.erased' ORDER BY id`;
      expect(registros.map((r) => r.meta.consultas)).toEqual([1, 0]);
    });
  });
});
