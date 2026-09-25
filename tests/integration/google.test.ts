/**
 * Integração com a agenda do Google (FASE-05) contra Postgres REAL e um
 * Google Calendar falso em memória (tests/setup/servicos-falsos.ts).
 *
 * Cobre os critérios de aceite da FASE-05 §8.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sqlCliente } from '@/lib/db';
import { _limparCacheEnv } from '@/lib/env';
import { dataLocal, somarMinutos } from '@/lib/datetime';
import { somarDias } from '@/lib/datetime-cliente';
import { decifrar } from '@/lib/crypto';
import { _limparTokens, removerConexao } from '@/lib/calendar/conexao';
import { agendamentoOnlineHabilitado, estadoAgenda } from '@/lib/calendar/freebusy';
import {
  criarAgendamento, cancelarPorToken, disponibilidade, practitionerId, revogarMotivoPorToken,
} from '@/lib/agendamento/servico';
import { efeitosDe } from '@/lib/agendamento/efeitos';
import { concluirConexaoAgenda } from '@/lib/auth/oauth';
import { receberDaAgenda } from '@/lib/calendar/receber';
import { reconciliar, sincronizarAgendamento } from '@/lib/calendar/sincronizar';
import { idEventoGoogle, type Tokens } from '@/lib/calendar/google';
import { renovarCanalSePreciso } from '@/lib/calendar/canal';
import { processarFila } from '@/lib/notificacoes/fila';
import type { CriarAgendamento } from '@/lib/validation/agendamento';
import { ENV_INTEGRACOES, instalarServicosFalsos, type GoogleFalso, type ResendFalso } from '../setup/servicos-falsos';
import { inserirConsulta, limparBanco } from '../setup/fabrica';

const d = process.env.DATABASE_URL_TEST ? describe : describe.skip;

d('agenda do Google (FASE-05)', () => {
  const sql = () => sqlCliente();
  let google: GoogleFalso;
  let resend: ResendFalso;
  let pid: string;

  const tokensOAuth = (): Tokens => ({
    access_token: 'at-inicial', expires_in: 3599, refresh_token: 'rt-segredo-do-google', scope: google.escopoConcedido,
  });

  beforeAll(async () => {
    for (const [k, v] of Object.entries(ENV_INTEGRACOES)) vi.stubEnv(k, v);
    _limparCacheEnv();
    pid = await practitionerId();
  });
  afterAll(async () => {
    vi.unstubAllEnvs(); vi.unstubAllGlobals(); _limparCacheEnv();
    await limparBanco(sql());
  });

  beforeEach(async () => {
    await limparBanco(sql());
    ({ google, resend } = instalarServicosFalsos());
    _limparTokens();
    const r = await concluirConexaoAgenda(pid, tokensOAuth());
    expect(r.ok).toBe(true);
    await receberDaAgenda(pid);           // pega o syncToken inicial
  });

  const hoje = () => dataLocal(new Date());
  async function slots(tipo = 'consulta-presencial') {
    const r = await disponibilidade({ tipo, de: hoje(), ate: somarDias(hoje(), 13) });
    return { r, lista: r.dias.flatMap((x) => x.slots) };
  }
  function pedido(inicio: string, extra: Partial<CriarAgendamento['paciente']> = {}): CriarAgendamento {
    return {
      tipo: 'consulta-presencial', inicio,
      paciente: {
        nome: 'Ana Souza', telefone: '+5511912345678', email: `ana.${randomUUID().slice(0, 8)}@exemplo.com`,
        motivo: '', consentimentoDados: true, consentimentoSaude: false, ...extra,
      },
    };
  }
  const ctx = () => ({ ip: `198.51.100.${Math.floor(Math.random() * 250)}`, idempotencyKey: randomUUID() });
  const chamadasFreeBusy = () => google.chamadas.filter((c) => c.caminho.endsWith('/freeBusy')).length;
  async function linha(id: string) {
    const [l] = await sql()`SELECT * FROM appointment WHERE id = ${id}`;
    return l!;
  }
  async function criarESincronizar(extra: Partial<CriarAgendamento['paciente']> = {}, indice = 0) {
    const { lista } = await slots();
    const r = await criarAgendamento(pedido(lista[indice]!.inicio, extra), ctx());
    await efeitosDe(r.agendamento.id);
    return r;
  }

  describe('conexão', () => {
    it('grava o refresh token CIFRADO — nunca o texto do Google', async () => {
      const [c] = await sql()`SELECT refresh_token_enc, account_email FROM calendar_connection`;
      expect(c!.refresh_token_enc).not.toContain('rt-segredo-do-google');
      expect(decifrar(c!.refresh_token_enc)).toBe('rt-segredo-do-google');
      expect(c!.account_email).toBe(google.email);
    });

    it('recusa escopo a menos, conta errada e ausência de refresh token', async () => {
      expect(await concluirConexaoAgenda(pid, { ...tokensOAuth(), scope: 'https://www.googleapis.com/auth/calendar.readonly' }))
        .toEqual({ ok: false, motivo: 'escopo' });
      expect(await concluirConexaoAgenda(pid, { ...tokensOAuth(), refresh_token: undefined }))
        .toEqual({ ok: false, motivo: 'sem-refresh' });
      google.email = 'outra.pessoa@exemplo.com';
      expect(await concluirConexaoAgenda(pid, tokensOAuth())).toEqual({ ok: false, motivo: 'conta' });
    });

    it('fora da produção, NUNCA conecta a agenda real da médica (FASE-13 §1)', async () => {
      google.email = 'andressa15correia@gmail.com';
      vi.stubEnv('ADMIN_EMAIL', google.email); _limparCacheEnv();
      try {
        expect(await concluirConexaoAgenda(pid, tokensOAuth())).toEqual({ ok: false, motivo: 'agenda-real' });
      } finally {
        vi.stubEnv('ADMIN_EMAIL', ENV_INTEGRACOES.ADMIN_EMAIL); _limparCacheEnv();
      }
    });

    it('canal push só com HTTPS; renova quando falta pouco para expirar', async () => {
      expect(await renovarCanalSePreciso(pid)).toMatchObject({ renovado: false, motivo: 'sem-https' });
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://draandressacorreia.com.br');
      try {
        expect(await renovarCanalSePreciso(pid)).toMatchObject({ renovado: true });
        expect(await renovarCanalSePreciso(pid)).toMatchObject({ renovado: false, motivo: 'em-dia' });
        // Daqui a 28 dias faltam 2 → renova e PARA o canal antigo.
        const daqui28 = new Date(Date.now() + 28 * 86_400_000);
        expect(await renovarCanalSePreciso(pid, daqui28)).toMatchObject({ renovado: true });
        expect(google.canais.map((c) => c.parado)).toEqual([true, false]);
      } finally {
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3100');
      }
    });
  });

  describe('leitura — FreeBusy', () => {
    it('compromisso pessoal dela tira o horário da oferta', async () => {
      const { lista } = await slots();
      const alvo = lista[0]!;
      await sql()`DELETE FROM busy_cache`;
      google.eventoPessoal(new Date(alvo.inicio), new Date(new Date(alvo.inicio).getTime() + 30 * 60_000));
      const depois = (await slots()).lista;
      expect(depois.some((s) => s.inicio === alvo.inicio)).toBe(false);
    });

    it('uma chamada de FreeBusy por requisição; a seguinte, em 60 s, vem do cache', async () => {
      const antes = chamadasFreeBusy();
      await slots();
      await slots();
      expect(chamadasFreeBusy() - antes).toBe(1);
    });

    it('Google fora do ar com cache recente → mesmos horários, marcados como degradados', async () => {
      const { lista: normal } = await slots();
      google.falhar('freebusy');
      await sql()`UPDATE busy_cache SET fetched_at = now() - interval '5 minutes'`;
      const { r, lista } = await slots();
      expect(r.degradado).toBe(true);
      expect(lista.map((s) => s.inicio)).toEqual(normal.map((s) => s.inicio));
    });

    it('Google fora do ar e SEM cache → não é erro 500: só oferta a partir de D+2', async () => {
      google.falhar('freebusy');
      await sql()`DELETE FROM busy_cache`;
      const { r, lista } = await slots();
      expect(r.degradado).toBe(true);
      const limite = Date.now() + 48 * 3_600_000;
      expect(lista.every((s) => new Date(s.inicio).getTime() >= limite)).toBe(true);
    });
  });

  describe('escrita — evento na agenda dela', () => {
    it('consulta confirmada vira evento com âncora, sem convite do Google', async () => {
      const r = await criarESincronizar();
      const ev = google.eventos.get(idEventoGoogle(r.agendamento.id))!;
      expect(ev.extendedProperties?.private?.appointmentId).toBe(r.agendamento.id);
      expect(ev.start.dateTime).toBe(r.agendamento.inicio);
      expect(ev.summary).toContain('Ana Souza');
      const l = await linha(r.agendamento.id);
      expect(l.sync_state).toBe('synced');
      expect(l.google_event_id).toBe(idEventoGoogle(r.agendamento.id));
    });

    it('o motivo vai no evento só se ela quiser (include_note_in_event)', async () => {
      const a = await criarESincronizar({ motivo: 'Dor de cabeça', consentimentoSaude: true }, 0);
      expect(google.eventos.get(idEventoGoogle(a.agendamento.id))!.description).toContain('Dor de cabeça');
      await sql()`UPDATE practitioner SET include_note_in_event = false`;
      const b = await criarESincronizar({ motivo: 'Exames', consentimentoSaude: true }, 1);
      const desc = google.eventos.get(idEventoGoogle(b.agendamento.id))!.description!;
      expect(desc).not.toContain('Exames');
      expect(desc).toContain('ver no painel');
    });

    it('Google fora do ar: a consulta É criada, fica `failed` com backoff e a reconciliação recupera', async () => {
      google.falhar('insert', 503);
      const r = await criarESincronizar();
      let l = await linha(r.agendamento.id);
      expect(l.status).toBe('confirmed');
      expect(l.sync_state).toBe('failed');
      expect(l.sync_attempts).toBe(1);
      expect(new Date(l.sync_next_at).getTime()).toBeGreaterThan(Date.now());

      google.curar();
      // Antes do backoff vencer, a reconciliação não mexe.
      expect((await reconciliar()).synced).toBe(0);
      expect((await reconciliar(new Date(Date.now() + 2 * 60_000))).synced).toBe(1);
      l = await linha(r.agendamento.id);
      expect(l.sync_state).toBe('synced');
      expect(google.ativos()).toHaveLength(1);
    });

    it('na 5ª falha desiste e avisa a médica (uma vez)', async () => {
      google.falhar('insert', 503);
      const r = await criarESincronizar();
      for (let i = 1; i < 5; i++) {
        await sql()`UPDATE appointment SET sync_next_at = now() - interval '1 second' WHERE id = ${r.agendamento.id}`;
        await sincronizarAgendamento(r.agendamento.id);
      }
      const l = await linha(r.agendamento.id);
      expect(l.sync_attempts).toBe(5);
      await processarFila();
      expect(resend.enviados.filter((e) => e.subject.startsWith('Consulta não chegou à sua agenda'))).toHaveLength(1);
      // Esgotado: sai da fila de reconciliação.
      expect((await reconciliar(new Date(Date.now() + 10 * 3_600_000))).falhou).toBe(0);
    });

    it('INSERT que deu certo sem ser registrado não duplica: 409 → PATCH', async () => {
      const { lista } = await slots();
      const r = await criarAgendamento(pedido(lista[0]!.inicio), ctx());
      // Simula: o Google gravou, a resposta se perdeu.
      await sincronizarAgendamento(r.agendamento.id);
      await sql()`UPDATE appointment SET sync_state = 'pending', google_event_id = NULL WHERE id = ${r.agendamento.id}`;
      await sincronizarAgendamento(r.agendamento.id);
      expect(google.ativos()).toHaveLength(1);
      expect((await linha(r.agendamento.id)).sync_state).toBe('synced');
    });

    /** Executa `durante` no meio do INSERT do evento no Google (chamada em voo). */
    function noMeioDoInsert(durante: () => Promise<unknown>) {
      const original = globalThis.fetch;
      let feito = false;
      vi.stubGlobal('fetch', async (u: string | URL | Request, init?: RequestInit) => {
        if (!feito && (init?.method ?? 'GET') === 'POST' && /\/events$/.test(new URL(String(u)).pathname)) {
          feito = true;
          await durante();
        }
        return original(u as string, init);
      });
      return () => vi.stubGlobal('fetch', original);
    }

    it('remarcada enquanto o INSERT estava em voo: não marca `synced` com o horário velho', async () => {
      const { lista } = await slots();
      const r = await criarAgendamento(pedido(lista[0]!.inicio), ctx());
      const id = r.agendamento.id;
      const novo = somarMinutos(new Date(lista[0]!.inicio), 24 * 60);
      // O que remarcarPelaMedica() grava: horário novo, SEQUENCE+1, sync pending.
      const restaurar = noMeioDoInsert(() => sql()`UPDATE appointment SET
        visit_starts_at = ${novo.toISOString()}, visit_ends_at = ${somarMinutos(novo, 40).toISOString()},
        starts_at = ${novo.toISOString()}, ends_at = ${somarMinutos(novo, 50).toISOString()},
        ics_sequence = ics_sequence + 1, sync_state = 'pending', updated_at = now() WHERE id = ${id}`);
      try {
        expect(await sincronizarAgendamento(id)).toBe('ignorado');
      } finally { restaurar(); }

      expect((await linha(id)).sync_state).toBe('pending');          // o próximo ciclo reenvia
      expect(await sincronizarAgendamento(id)).toBe('synced');
      expect(new Date(google.eventos.get(idEventoGoogle(id))!.start.dateTime).toISOString()).toBe(novo.toISOString());
      expect(google.ativos()).toHaveLength(1);
    });

    it('motivo revogado enquanto o INSERT estava em voo: o evento é reescrito sem ele', async () => {
      const { lista } = await slots();
      const r = await criarAgendamento(pedido(lista[0]!.inicio, { motivo: 'Dor de cabeça', consentimentoSaude: true }), ctx());
      const id = r.agendamento.id;
      const token = r.agendamento.urlGestao.split('/').pop()!;
      const restaurar = noMeioDoInsert(() => revogarMotivoPorToken(token));
      try {
        expect(await sincronizarAgendamento(id)).toBe('ignorado');
      } finally { restaurar(); }
      expect(google.eventos.get(idEventoGoogle(id))!.description).toContain('Dor de cabeça');   // o que estava em voo

      expect((await linha(id)).sync_state).toBe('pending');
      expect(await sincronizarAgendamento(id)).toBe('synced');
      expect(google.eventos.get(idEventoGoogle(id))!.description).not.toContain('Dor de cabeça');
    });

    it('cancelar pelo link apaga o evento da agenda dela', async () => {
      const r = await criarESincronizar();
      const token = r.agendamento.urlGestao.split('/').pop()!;
      await cancelarPorToken(token);
      await efeitosDe(r.agendamento.id);
      expect(google.eventos.get(idEventoGoogle(r.agendamento.id))!.status).toBe('cancelled');
      expect((await linha(r.agendamento.id)).sync_state).toBe('synced');
    });
  });

  describe('recebimento — mudanças feitas no celular', () => {
    it('apagar o evento no Google cancela a consulta e avisa o paciente com CANCEL + SEQUENCE maior', async () => {
      const r = await criarESincronizar();
      google.apagarPelaMedica(idEventoGoogle(r.agendamento.id));
      const res = await receberDaAgenda(pid);
      expect(res).toMatchObject({ cancelados: 1 });

      const l = await linha(r.agendamento.id);
      expect(l.status).toBe('cancelled');
      expect(l.cancelled_by).toBe('calendar');
      expect(l.ics_sequence).toBe(1);

      await processarFila();
      const email = resend.para(l.patient_email).find((e) => e.subject.startsWith('Consulta cancelada'))!;
      expect(email).toBeTruthy();
      const ics = resend.icsDe(email)!;
      expect(ics).toContain('METHOD:CANCEL');
      expect(ics).toContain('SEQUENCE:1');
      expect(ics).toContain(`UID:${l.ics_uid}`);
      // Rodar de novo não cancela/avisa duas vezes.
      expect(await receberDaAgenda(pid)).toMatchObject({ cancelados: 0 });
    });

    it('mover o evento remarca a consulta: novo horário, SEQUENCE+1, e-mail com o .ics novo', async () => {
      const r = await criarESincronizar();
      const novo = new Date(new Date(r.agendamento.inicio).getTime() + 3 * 3_600_000);
      google.moverPelaMedica(idEventoGoogle(r.agendamento.id), novo, new Date(novo.getTime() + 40 * 60_000));
      expect(await receberDaAgenda(pid)).toMatchObject({ remarcados: 1 });

      const l = await linha(r.agendamento.id);
      expect(new Date(l.visit_starts_at).toISOString()).toBe(novo.toISOString());
      expect(new Date(l.starts_at).toISOString()).toBe(novo.toISOString());      // sem buffer antes
      expect(new Date(l.ends_at).getTime() - novo.getTime()).toBe(50 * 60_000);  // 40 + 10 de buffer
      expect(l.ics_sequence).toBe(1);

      await processarFila();
      const email = resend.para(l.patient_email).find((e) => e.subject.startsWith('Consulta remarcada'))!;
      const ics = resend.icsDe(email)!;
      expect(ics).toContain('METHOD:REQUEST');
      expect(ics).toContain('SEQUENCE:1');
    });

    it('mover para cima de outra consulta NÃO causa overbooking: mantém e avisa a médica', async () => {
      const a = await criarESincronizar({}, 0);
      const b = await criarESincronizar({}, 1);
      google.moverPelaMedica(idEventoGoogle(a.agendamento.id), new Date(b.agendamento.inicio), new Date(b.agendamento.fim));
      expect(await receberDaAgenda(pid)).toMatchObject({ conflitos: 1, remarcados: 0 });
      expect(new Date((await linha(a.agendamento.id)).visit_starts_at).toISOString()).toBe(a.agendamento.inicio);
      await processarFila();
      expect(resend.enviados.some((e) => e.subject.startsWith('Não foi possível mover a consulta'))).toBe(true);
    });

    it('syncToken expirado (410) dispara sincronização completa sem intervenção', async () => {
      const r = await criarESincronizar();
      google.expirarSyncTokens();
      google.apagarPelaMedica(idEventoGoogle(r.agendamento.id));
      const res = await receberDaAgenda(pid);
      expect(res).toMatchObject({ completo: true, cancelados: 1 });
      // E o token novo volta a funcionar incrementalmente.
      expect(await receberDaAgenda(pid)).toMatchObject({ completo: false });
    });

    it('evento pessoal dela é ignorado (não é consulta)', async () => {
      google.eventoPessoal(new Date(Date.now() + 86_400_000), new Date(Date.now() + 90_000_000));
      expect(await receberDaAgenda(pid)).toMatchObject({ cancelados: 0, remarcados: 0 });
    });
  });

  describe('acesso revogado (invalid_grant)', () => {
    it('marca a conexão, avisa a médica e o site segue agendando em modo degradado (D+2)', async () => {
      google.revogado = true;
      _limparTokens();
      const { lista } = await slots();
      expect(lista.every((s) => new Date(s.inicio).getTime() >= Date.now() + 48 * 3_600_000)).toBe(true);

      expect(await estadoAgenda(pid)).toBe('revogada');
      const r = await criarAgendamento(pedido(lista[0]!.inicio), ctx());
      await efeitosDe(r.agendamento.id);
      expect((await linha(r.agendamento.id)).sync_state).toBe('pending');
      await processarFila();
      expect(resend.enviados.filter((e) => e.subject.includes('agenda do Google foi desconectada'))).toHaveLength(1);
    });
  });

  describe('desconectar e "agendamento online habilitado?"', () => {
    it('desconectar revoga no Google, para o canal e apaga a credencial — consultas ficam', async () => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://draandressacorreia.com.br');
      try {
        await renovarCanalSePreciso(pid);
        const r = await criarESincronizar();
        await removerConexao(pid);
        expect(google.revogado).toBe(true);
        expect(google.canais.every((c) => c.parado)).toBe(true);
        expect(await sql()`SELECT 1 FROM calendar_connection`).toHaveLength(0);
        expect((await linha(r.agendamento.id)).status).toBe('confirmed');
      } finally {
        vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3100');
      }
    });

    it('em produção: conectada ou revogada → sim (revogada degrada); nunca conectada → só com opt-in', async () => {
      vi.stubEnv('VERCEL_ENV', 'production');
      try {
        expect(await agendamentoOnlineHabilitado(pid)).toBe(true);                // conectada
        await sql()`UPDATE calendar_connection SET revoked_at = now()`;
        expect(await estadoAgenda(pid)).toBe('revogada');
        expect(await agendamentoOnlineHabilitado(pid)).toBe(true);                // D+2, com alerta
        await sql()`DELETE FROM calendar_connection`;
        expect(await agendamentoOnlineHabilitado(pid)).toBe(false);               // cai no WhatsApp
        vi.stubEnv('AGENDAMENTO_SEM_GOOGLE', 'aceito');
        expect(await agendamentoOnlineHabilitado(pid)).toBe(true);                // decisão consciente
      } finally {
        vi.stubEnv('VERCEL_ENV', ''); vi.stubEnv('AGENDAMENTO_SEM_GOOGLE', '');
      }
    });
  });

  it('consulta do dia seguinte inserida direto também é sincronizada pela reconciliação', async () => {
    const amanha = new Date(Date.now() + 30 * 3_600_000);
    const { id } = await inserirConsulta(sql(), { inicio: amanha });
    await sql()`UPDATE appointment SET sync_state = 'pending' WHERE id = ${id}`;
    expect((await reconciliar()).synced).toBe(1);
    expect(google.eventos.has(idEventoGoogle(id))).toBe(true);
  });
});
