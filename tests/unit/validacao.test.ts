import { describe, it, expect } from 'vitest';
import { telefoneValido, mascararTelefone, normalizarTelefone, digitosNacionais } from '@/lib/telefone';
import { schemaDadosPaciente, schemaCriarAgendamento, errosPorCampo, sugerirEmail, MSG } from '@/lib/validation/agendamento';

describe('telefone', () => {
  it.each([
    ['(11) 99805-3826', true],
    ['11998053826', true],
    ['+55 11 99805-3826', true],
    ['(11) 3456-7890', true],        // fixo
    ['(10) 99805-3826', false],      // DDD inexistente
    ['(11) 89805-3826', false],      // celular sem o 9
    ['(11) 9980-532', false],        // curto
    ['(11) 1456-7890', false],       // fixo começando com 1
    ['+55 (11) 3456-7890', true],    // fixo com 55 (12 dígitos)
    ['(11) 99805-38269', false],     // 12 dígitos SEM 55: dígito a mais, não truncar
    ['+55 (11) 99805-38269', false], // 14 dígitos
    ['119980538269999', false],
  ])('%s → %s', (v, esperado) => expect(telefoneValido(v)).toBe(esperado));

  it('máscara progressiva', () => {
    expect(mascararTelefone('1')).toBe('(1');
    expect(mascararTelefone('119')).toBe('(11) 9');
    expect(mascararTelefone('1199805')).toBe('(11) 99805');
    expect(mascararTelefone('11998053826')).toBe('(11) 99805-3826');
    expect(mascararTelefone('1134567890')).toBe('(11) 3456-7890');
  });

  it('tira o prefixo 55; a MÁSCARA (só ela) corta além do 11º dígito', () => {
    expect(digitosNacionais('5511998053826')).toBe('11998053826');
    expect(digitosNacionais('(11) 99805-38269')).toBe('119980538269');   // não trunca em silêncio
    expect(mascararTelefone('119980538269999')).toBe('(11) 99805-3826');
    expect(mascararTelefone('+55 11 99805-3826')).toBe('(11) 99805-3826');
  });

  it('normaliza para E.164', () => {
    expect(normalizarTelefone('(11) 99805-3826')).toBe('+5511998053826');
  });
});

describe('schemaDadosPaciente', () => {
  const ok = {
    nome: 'Ana Souza', telefone: '(11) 91234-5678', email: 'Ana@Exemplo.com',
    motivo: '', consentimentoDados: true, consentimentoSaude: false,
  };

  it('aceita dados válidos e normaliza', () => {
    const r = schemaDadosPaciente.parse(ok);
    expect(r.telefone).toBe('+5511912345678');
    expect(r.email).toBe('ana@exemplo.com');
  });

  it('telefone com dígito a mais é recusado, não vira outro número', () => {
    const r = schemaDadosPaciente.safeParse({ ...ok, telefone: '(11) 99805-38269' });
    expect(r.success).toBe(false);
    expect(errosPorCampo(r.error!).telefone).toBe(MSG.telefone);
  });

  it('exige nome e sobrenome', () => {
    const r = schemaDadosPaciente.safeParse({ ...ok, nome: 'Ana' });
    expect(r.success).toBe(false);
    expect(errosPorCampo(r.error!).nome).toBe(MSG.nome);
  });

  it('sem consentimento de dados, não agenda', () => {
    const r = schemaDadosPaciente.safeParse({ ...ok, consentimentoDados: false });
    expect(errosPorCampo(r.error!).consentimentoDados).toBe(MSG.consentimentoDados);
  });

  it('motivo preenchido EXIGE consentimento de saúde (LGPD Art. 11)', () => {
    const r = schemaDadosPaciente.safeParse({ ...ok, motivo: 'Resultado de exames' });
    expect(r.success).toBe(false);
    expect(errosPorCampo(r.error!).consentimentoSaude).toBe(MSG.consentimentoSaude);
    expect(schemaDadosPaciente.safeParse({ ...ok, motivo: 'Resultado de exames', consentimentoSaude: true }).success).toBe(true);
  });

  it('motivo só com espaços conta como vazio', () => {
    expect(schemaDadosPaciente.safeParse({ ...ok, motivo: '   ' }).success).toBe(true);
  });
});

describe('schemaCriarAgendamento', () => {
  const corpo = {
    tipo: 'consulta-presencial', inicio: '2026-10-06T17:00:00.000Z',
    paciente: { nome: 'Ana Souza', telefone: '11912345678', email: 'a@b.com', consentimentoDados: true },
  };
  it('aceita corpo válido', () => expect(schemaCriarAgendamento.safeParse(corpo).success).toBe(true));
  it('rejeita honeypot preenchido', () =>
    expect(schemaCriarAgendamento.safeParse({ ...corpo, site: 'http://spam' }).success).toBe(false));
  it('rejeita slug com caracteres estranhos', () =>
    expect(schemaCriarAgendamento.safeParse({ ...corpo, tipo: "x'; drop" }).success).toBe(false));
  it('rejeita data sem fuso', () =>
    expect(schemaCriarAgendamento.safeParse({ ...corpo, inicio: '2026-10-06 14:00' }).success).toBe(false));
});

describe('sugerirEmail', () => {
  it('sugere o domínio certo', () => expect(sugerirEmail('ana@gmial.com')).toBe('ana@gmail.com'));
  it('não sugere quando está certo', () => expect(sugerirEmail('ana@gmail.com')).toBeNull());
});
