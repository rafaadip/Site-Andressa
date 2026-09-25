/**
 * Regressões unitárias da auditoria de segurança (docs/SEGURANCA.md).
 */
import { describe, it, expect } from 'vitest';
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
