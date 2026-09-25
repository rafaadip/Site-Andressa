/**
 * E-mails (FASE-08) contra Postgres REAL e uma Resend falsa.
 * Cobre os critérios de aceite da FASE-08 §7 que são automatizáveis.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { sqlCliente } from '@/lib/db';
import { _limparCacheEnv } from '@/lib/env';
import { dataLocal, horaLocalParaUtc, somarMinutos } from '@/lib/datetime';
import { somarDias } from '@/lib/datetime-cliente';
import { criarAgendamento, cancelarPorToken, disponibilidade } from '@/lib/agendamento/servico';
import { processarFila } from '@/lib/notificacoes/fila';
import { lembretesD1, lembretesH2 } from '@/lib/notificacoes/lembretes';
import { assinaturaValida, processarEventoResend } from '@/lib/email/webhook';
import type { CriarAgendamento } from '@/lib/validation/agendamento';
import { ENV_INTEGRACOES, instalarServicosFalsos, type ResendFalso } from '../setup/servicos-falsos';
import { inserirConsulta, limparBanco } from '../setup/fabrica';

const d = process.env.DATABASE_URL_TEST ? describe : describe.skip;

d('e-mails e lembretes (FASE-08)', () => {
  const sql = () => sqlCliente();
  let resend: ResendFalso;

  beforeAll(() => {
    // Só a Resend: sem Google conectado, a agenda não entra nesta suíte.
    for (const [k, v] of Object.entries(ENV_INTEGRACOES)) if (!k.startsWith('GOOGLE')) vi.stubEnv(k, v);
    _limparCacheEnv();
  });
  afterAll(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); _limparCacheEnv(); await limparBanco(sql()); });
  beforeEach(async () => {
    await limparBanco(sql());
    ({ resend } = instalarServicosFalsos());
  });

  async function criar(extra: Partial<CriarAgendamento['paciente']> = {}) {
    const hoje = dataLocal(new Date());
    const r = await disponibilidade({ tipo: 'consulta-presencial', de: hoje, ate: somarDias(hoje, 13) });
    const slot = r.dias.flatMap((x) => x.slots)[0]!;
    const email = `ana.${randomUUID().slice(0, 8)}@exemplo.com`;
    const c = await criarAgendamento({
      tipo: 'consulta-presencial', inicio: slot.inicio,
      paciente: { nome: 'Ana Souza', telefone: '+5511912345678', email, motivo: '', consentimentoDados: true, consentimentoSaude: false, ...extra },
    }, { ip: '192.0.2.10', idempotencyKey: randomUUID() });
    return { ...c, email: extra.email ?? email };
  }

  describe('confirmação', () => {
    it('paciente recebe a confirmação com .ics REQUEST anexado e versão texto', async () => {
      const { email, agendamento } = await criar();
      await processarFila();
      const [m] = resend.para(email);
      expect(m!.subject).toMatch(/^Consulta confirmada — /);
      const anexo = m!.attachments![0]!;
      expect(anexo.content_type).toBe('text/calendar; charset=utf-8; method=REQUEST');
      const ics = resend.icsDe(m!)!;
      expect(ics).toContain('METHOD:REQUEST');
      expect(ics).toContain('SEQUENCE:0');
      // Desdobra as linhas (RFC 5545 §3.1) antes de procurar o link.
      expect(ics.replace(/\r\n /g, '')).toContain(agendamento.urlGestao);
      // Versão texto completa, identificação CFM e aviso de urgência.
      expect(m!.text).toContain(agendamento.urlGestao);
      expect(m!.text).toContain('CRM-SP');
      expect(m!.html).toContain('192');
      expect(m!.idempotencia).toMatch(/^confirmacao:/);
    });

    it('médica é avisada, SEM o motivo no e-mail (dado de saúde fica atrás do login)', async () => {
      await criar({ motivo: 'Resultado de exame de tireoide', consentimentoSaude: true });
      await processarFila();
      const aviso = resend.para(ENV_INTEGRACOES.ADMIN_EMAIL).find((e) => e.subject.startsWith('Nova consulta'))!;
      expect(aviso).toBeTruthy();
      expect(aviso.html).not.toContain('tireoide');
      expect(aviso.text).not.toContain('tireoide');
      expect(aviso.text).toContain('veja no painel');
    });

    it('processar a fila duas vezes não duplica e-mail', async () => {
      const { email } = await criar();
      await processarFila();
      await processarFila();
      expect(resend.para(email)).toHaveLength(1);
    });

    it('Resend fora do ar: fica na fila com backoff e sai depois', async () => {
      const { email } = await criar();
      resend.falharCom = 503;
      expect((await processarFila()).failed).toBe(2);
      const [n] = await sql()`SELECT status, attempts, next_at FROM notification WHERE kind = 'confirmacao'`;
      expect(n!.status).toBe('failed');
      expect(new Date(n!.next_at).getTime()).toBeGreaterThan(Date.now());

      resend.falharCom = null;
      expect((await processarFila()).sent).toBe(0);                       // backoff ainda não venceu
      await processarFila({ agora: new Date(Date.now() + 2 * 60_000) });
      expect(resend.para(email)).toHaveLength(1);
    });

    it('erro definitivo (422 da Resend) não fica tentando para sempre', async () => {
      await criar();
      resend.falharCom = 422;
      await processarFila();
      const linhas = await sql()`SELECT attempts FROM notification`;
      expect(linhas.every((l) => l.attempts === 5)).toBe(true);
    });

    it('sem Resend configurada, a fila não trava: marca como `skipped`', async () => {
      vi.stubEnv('RESEND_API_KEY', ''); _limparCacheEnv();
      try {
        await criar();
        expect((await processarFila()).skipped).toBe(2);
      } finally {
        vi.stubEnv('RESEND_API_KEY', ENV_INTEGRACOES.RESEND_API_KEY); _limparCacheEnv();
      }
    });
  });

  describe('cancelamento', () => {
    it('paciente recebe o .ics CANCEL (SEQUENCE maior); médica é avisada', async () => {
      const { email, agendamento } = await criar();
      await processarFila();
      await cancelarPorToken(agendamento.urlGestao.split('/').pop()!);
      await processarFila();
      const m = resend.para(email).find((e) => e.subject.startsWith('Consulta cancelada'))!;
      expect(m.text).toContain('como você pediu');
      const ics = resend.icsDe(m)!;
      expect(ics).toContain('METHOD:CANCEL');
      expect(ics).toContain('SEQUENCE:1');
      expect(resend.para(ENV_INTEGRACOES.ADMIN_EMAIL).some((e) => e.subject.startsWith('Consulta cancelada pelo paciente'))).toBe(true);
    });
  });

  describe('lembretes', () => {
    const amanhaAs10 = () => {
      const amanha = dataLocal(somarMinutos(horaLocalParaUtc(dataLocal(new Date()), '12:00'), 24 * 60));
      return horaLocalParaUtc(amanha, '10:00');
    };
    const ontem = () => new Date(Date.now() - 86_400_000);

    it('D-1: consulta de amanhã recebe UM lembrete, mesmo com o cron rodando duas vezes', async () => {
      const { id } = await inserirConsulta(sql(), { inicio: amanhaAs10(), email: 'd1@exemplo.com', criadaEm: ontem() });
      await lembretesD1();
      await lembretesD1();
      const m = resend.para('d1@exemplo.com');
      expect(m).toHaveLength(1);
      expect(m[0]!.subject).toMatch(/^Lembrete: sua consulta é amanhã/);
      expect(m[0]!.headers?.['List-Unsubscribe']).toMatch(/^<mailto:/);
      const [l] = await sql()`SELECT reminder_d1_at FROM appointment WHERE id = ${id}`;
      expect(l!.reminder_d1_at).not.toBeNull();
    });

    it('D-1 em dia de 25 h (fim do horário de verão): a consulta das 23:30 também é lembrada', async () => {
      // 16/02/2019 em São Paulo teve 25 h: "00:00 + 24 h" terminava às 23:00 locais.
      const { id } = await inserirConsulta(sql(), {
        inicio: horaLocalParaUtc('2019-02-16', '23:30'), email: 'dst@exemplo.com', criadaEm: new Date('2019-01-01T12:00:00Z'),
      });
      const r = await lembretesD1(horaLocalParaUtc('2019-02-15', '18:00'));
      expect(r.enfileirados).toBe(1);
      expect(await sql()`SELECT 1 FROM notification WHERE appointment_id = ${id} AND kind = 'lembrete_d1'`).toHaveLength(1);
    });

    it('D-1: nada para consulta cancelada, nem para quem acabou de agendar', async () => {
      await inserirConsulta(sql(), { inicio: amanhaAs10(), email: 'cancelada@exemplo.com', criadaEm: ontem(), status: 'cancelled' });
      await inserirConsulta(sql(), { inicio: somarMinutos(amanhaAs10(), 60), email: 'recente@exemplo.com' });
      await lembretesD1();
      expect(resend.enviados).toHaveLength(0);
    });

    it('lembrete já enfileirado não sai se a consulta for cancelada antes do envio', async () => {
      const { id } = await inserirConsulta(sql(), { inicio: amanhaAs10(), email: 'mudou@exemplo.com', criadaEm: ontem() });
      resend.falharCom = 503;
      await lembretesD1();
      await sql()`UPDATE appointment SET status = 'cancelled' WHERE id = ${id}`;
      resend.falharCom = null;
      await processarFila({ agora: new Date(Date.now() + 10 * 60_000) });
      expect(resend.para('mudou@exemplo.com')).toHaveLength(0);
    });

    it('H-2: consulta daqui a 2 h recebe um lembrete; teleconsulta leva o link da sala', async () => {
      await sql()`UPDATE practitioner SET telehealth_url = 'https://meet.exemplo.com/sala-da-dra'`;
      await inserirConsulta(sql(), {
        inicio: new Date(Date.now() + 2 * 3_600_000), email: 'h2@exemplo.com', criadaEm: ontem(),
        tipo: '00000000-0000-4000-8000-000000000012',
      });
      await lembretesH2();
      await lembretesH2();
      const m = resend.para('h2@exemplo.com');
      expect(m).toHaveLength(1);
      expect(m[0]!.text).toContain('https://meet.exemplo.com/sala-da-dra');
    });

    it('caminho feliz: no máximo 3 e-mails ao paciente (confirmação, D-1, H-2)', async () => {
      const inicio = amanhaAs10();
      const { id } = await inserirConsulta(sql(), { inicio, email: 'feliz@exemplo.com', criadaEm: ontem() });
      await sql()`INSERT INTO notification (dedup_key, appointment_id, kind, recipient) VALUES (${`confirmacao:${id}`}, ${id}, 'confirmacao', 'patient')`;
      await processarFila();
      await lembretesD1();
      await lembretesH2(new Date(inicio.getTime() - 2 * 3_600_000));
      await lembretesH2(new Date(inicio.getTime() - 100 * 60_000));
      expect(resend.para('feliz@exemplo.com')).toHaveLength(3);
    });
  });

  describe('bounce (webhook da Resend)', () => {
    const segredo = `whsec_${Buffer.from('segredo-do-webhook').toString('base64')}`;
    const assinar = (id: string, ts: string, corpo: string) =>
      `v1,${createHmac('sha256', Buffer.from('segredo-do-webhook')).update(`${id}.${ts}.${corpo}`).digest('base64')}`;

    it('confere a assinatura Svix e recusa replay antigo ou corpo alterado', () => {
      const ts = String(Math.floor(Date.now() / 1000));
      const corpo = '{"type":"email.bounced"}';
      expect(assinaturaValida({ segredo, id: 'msg_1', timestamp: ts, assinaturas: assinar('msg_1', ts, corpo), corpo })).toBe(true);
      expect(assinaturaValida({ segredo, id: 'msg_1', timestamp: ts, assinaturas: assinar('msg_1', ts, corpo), corpo: `${corpo} ` })).toBe(false);
      const velho = String(Math.floor(Date.now() / 1000) - 3600);
      expect(assinaturaValida({ segredo, id: 'msg_1', timestamp: velho, assinaturas: assinar('msg_1', velho, corpo), corpo })).toBe(false);
      expect(assinaturaValida({ segredo, id: 'msg_1', timestamp: ts, assinaturas: null, corpo })).toBe(false);
    });

    it('marca o e-mail do paciente como inválido, avisa a médica e para de mandar e-mail a ele', async () => {
      const { email, agendamento } = await criar();
      await processarFila();
      const [n] = await sql()`SELECT provider_id FROM notification WHERE kind = 'confirmacao'`;
      expect(await processarEventoResend({ type: 'email.bounced', data: { email_id: n!.provider_id } })).toBe('marcado');
      await processarFila();
      const alerta = resend.para(ENV_INTEGRACOES.ADMIN_EMAIL).find((e) => e.subject.startsWith('E-mail do paciente não foi entregue'))!;
      expect(alerta.text).toContain('+5511912345678');

      await cancelarPorToken(agendamento.urlGestao.split('/').pop()!);
      await processarFila();
      expect(resend.para(email)).toHaveLength(1);           // só a confirmação original
      // Repetir o webhook não repete o alerta.
      await processarEventoResend({ type: 'email.bounced', data: { email_id: n!.provider_id } });
      await processarFila();
      expect(resend.para(ENV_INTEGRACOES.ADMIN_EMAIL).filter((e) => e.subject.startsWith('E-mail do paciente'))).toHaveLength(1);
    });
  });
});
