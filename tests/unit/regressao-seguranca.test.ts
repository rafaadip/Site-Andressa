/**
 * Regressões unitárias da auditoria de segurança (docs/SEGURANCA.md).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { _limparTetoSentry, reportarAoSentry } from '@/lib/observabilidade';
import { tlsDoBanco, TlsObrigatorioError } from '@/lib/db/tls';
import { semearHorariosFicticios } from '@/scripts/seed';
import { errosPorCampo, MSG, schemaDadosPaciente } from '@/lib/validation/agendamento';
import { escapar, gerarIcs, parametro } from '@/lib/calendar/ics';

const base = {
  nome: 'Ana Souza', telefone: '(11) 91234-5678', email: 'ana@exemplo.com',
  motivo: '', consentimentoDados: true, consentimentoSaude: true,
};

describe('SEC-05: nome não carrega URL nem texto de golpe', () => {
  it.each([
    'https://pix-golpe.example/boleto Urgente',
    'Ana:mailto:x@y Silva',
    'Ana Silva <script>',
    'Regularize em 24h Silva',
    'Ana @ Silva',
  ])('recusa %j', (nome) => {
    const r = schemaDadosPaciente.safeParse({ ...base, nome });
    expect(r.success).toBe(false);
    expect(errosPorCampo(r.error!).nome).toBe(MSG.nomeCaracteres);
  });

  it.each([
    ["Maria D'Ávila-Souza", "Maria D'Ávila-Souza"],
    ['José da Silva Jr.', 'José da Silva Jr.'],
    ['Ana   Maria  Souza', 'Ana Maria Souza'],
    ['Nguyễn Văn An', 'Nguyễn Văn An'],
    ['Ana Maria O’Neil', 'Ana Maria O’Neil'],
  ])('aceita %j', (nome, esperado) => {
    const r = schemaDadosPaciente.safeParse({ ...base, nome });
    expect(r.success).toBe(true);
    expect(r.data!.nome).toBe(esperado);
  });

  it('NFC: o nome decomposto (macOS) vira a forma composta', () => {
    const r = schemaDadosPaciente.parse({ ...base, nome: 'José Souza' });
    expect(r.nome).toBe('José Souza');
  });
});

describe('SEC-11: invisíveis não chegam ao banco (NUL = 500 no Postgres)', () => {
  it('nome: controle e zero-width viram espaço', () => {
    for (const nome of ['Ana\u0000 Silva', 'Ana\rSilva', 'Ana​Silva', 'Ana\u2028Silva', 'Ana\tSilva']) {
      const r = schemaDadosPaciente.parse({ ...base, nome });
      expect(r.nome).toBe('Ana Silva');
    }
  });

  it('motivo: sai o controle, fica a quebra de linha', () => {
    const r = schemaDadosPaciente.parse({ ...base, motivo: 'dor\u0000 de\r\ncabeça\u2028 há\t2 dias' });
    expect(r.motivo).toBe('dor de\ncabeça há\t2 dias');
    expect(r.motivo).not.toMatch(/[\u0000\r\u2028]/);
  });
});

describe('SEC-09: .ics sem CR solto e CN entre aspas', () => {
  it('escapar(): CR solto vira \\n e controle sai', () => {
    expect(escapar('a\rEND:VEVENT\rb')).toBe('a\\nEND:VEVENT\\nb');
    expect(escapar('a\u0000b\u0007c')).toBe('abc');
    expect(escapar('x;y,z\\w\r\nv')).toBe('x\\;y\\,z\\\\w\\nv');
  });

  it('parametro(): aspas, sem aspas internas nem controle', () => {
    expect(parametro('Ana:mailto:x@evil')).toBe('"Ana:mailto:x@evil"');
    expect(parametro('Ana "B"\r\nC')).toBe('"Ana BC"');
  });

  it('gerarIcs() com nome malicioso: 1 VEVENT e nenhum CR fora de CRLF', () => {
    const ics = gerarIcs({
      uid: 'u1@teste', sequence: 0,
      inicio: new Date('2026-10-06T13:00:00Z'), fim: new Date('2026-10-06T13:40:00Z'),
      tipoLabel: 'Consulta presencial', modalidade: 'in_person',
      pacienteNome: 'Ana\rEND:VEVENT\rBEGIN:VEVENT\rX: Silva', pacienteEmail: 'ana@exemplo.com',
      organizadorEmail: 'medica@exemplo.com',
    }, 'REQUEST');
    expect(ics).not.toMatch(/\r(?!\n)/);
    expect(ics.split(/\r\n|\r|\n/).filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(ics).toMatch(/ATTENDEE;CN="Ana/);
  });
});

describe('SEC-07: erro de banco não leva params (nome, motivo) ao Sentry', () => {
  beforeEach(() => {
    _limparTetoSentry();
    vi.stubEnv('SENTRY_DSN', 'https://chave@o1.ingest.sentry.io/42');
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); _limparTetoSentry(); });

  const enviar = async (e: unknown) => {
    const f = vi.fn(async () => new Response(null, { status: 200 })); vi.stubGlobal('fetch', f);
    await reportarAoSentry('admin.cancelar', e);
    return f;
  };

  it('DrizzleQueryError vira só o SQLSTATE; params e SQL não saem', async () => {
    const causa = Object.assign(new Error('canceling statement due to statement timeout'), { code: '57014' });
    const erro = new DrizzleQueryError('update "appointment" set "cancel_reason" = $1', ['Maria', 'remarcar apos exame de HIV'], causa);
    const f = await enviar(erro);
    const corpo = String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body);
    expect(corpo).toContain('postgres 57014');
    expect(corpo).not.toMatch(/Maria|HIV|cancel_reason/);
  });

  it('mensagem de várias linhas: só a 1ª sai, mascarada', async () => {
    const f = await enviar(new Error('falhou para ana@gmail.com\nparams: Maria,diabetes'));
    const corpo = String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body);
    expect(corpo).toContain('[email]');
    expect(corpo).not.toMatch(/Maria|diabetes/);
  });

  it('SEC-11: teto por minuto — erro provocado em massa não esgota a cota', async () => {
    const f = vi.fn(async () => new Response(null, { status: 200 })); vi.stubGlobal('fetch', f);
    for (let i = 0; i < 50; i++) await reportarAoSentry('api.erro', new Error('x'));
    expect(f).toHaveBeenCalledTimes(5);
    await reportarAoSentry('outro.evento', new Error('y'));
    expect(f).toHaveBeenCalledTimes(6);
  });
});

describe('SEC-03: TLS do banco', () => {
  const url = 'postgresql://u:s@db.exemplo.supabase.co:6543/postgres';
  const PEM = '-----BEGIN CERTIFICATE-----\\nMIIB\\n-----END CERTIFICATE-----';

  it('com a CA: verifica o certificado (e aceita o PEM numa linha só, como na Vercel)', () => {
    expect(tlsDoBanco(url, { DATABASE_CA_CERT: PEM })).toEqual({
      ca: '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----', rejectUnauthorized: true,
    });
  });

  it('host remoto sem sslmode: no mínimo cifra', () => {
    expect(tlsDoBanco(url, {})).toBe('require');
    expect(tlsDoBanco('postgres://u:p%40ss@10.0.0.5/db', {})).toBe('require');
  });

  it.each(['disable', 'allow', 'prefer'])('host remoto com sslmode=%s (cai para texto puro): recusa', (modo) => {
    expect(() => tlsDoBanco(`${url}?sslmode=${modo}`, {})).toThrow(TlsObrigatorioError);
  });

  it('sslmode=verify-full: o driver verifica (não sobrescreve)', () => {
    expect(tlsDoBanco(`${url}?sslmode=verify-full`, {})).toBeUndefined();
  });

  it.each([
    'postgresql://postgres@127.0.0.1:55432/x', 'postgresql://localhost/x', 'postgresql://u@[::1]:5432/x',
  ])('host local (%s): vale a URL', (u) => {
    expect(tlsDoBanco(u, {})).toBeUndefined();
  });
});

describe('SEC-13: seed não apaga a semana real', () => {
  const remoto = 'postgresql://u:s@db.exemplo.supabase.co:5432/postgres?sslmode=require';
  it('banco remoto, sem confirmação: não semeia horários (nem apaga), qualquer NODE_ENV', () => {
    expect(semearHorariosFicticios(remoto, { NODE_ENV: 'development' })).toBe(false);
    expect(semearHorariosFicticios(remoto, {})).toBe(false);
  });
  it('banco local fora da produção: semeia (dev e testes)', () => {
    expect(semearHorariosFicticios('postgresql://postgres@127.0.0.1:55432/andressa', { NODE_ENV: 'development' })).toBe(true);
  });
  it('confirmação explícita vale em qualquer banco', () => {
    expect(semearHorariosFicticios(remoto, { SEED_CONFIRMO_FICTICIO: 'sim' })).toBe(true);
  });
});
