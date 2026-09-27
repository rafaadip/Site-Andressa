import { describe, it, expect } from 'vitest';
import { validarContato, CONTATO_VAZIO, MSG_CONTATO, type FormularioContatoDados } from '@/lib/validation/contato';
import { linkWhatsApp, mensagemContato } from '@/lib/contato';
import { PROFISSIONAL } from '@/lib/config';

const VALIDO: FormularioContatoDados = {
  nome: 'Maria', sobrenome: 'da Silva', email: 'maria@exemplo.com',
  telefone: '', idade: '34', horario: '', motivo: 'emagrecimento', consentimento: true,
};
const com = (parcial: Partial<FormularioContatoDados>) => validarContato({ ...VALIDO, ...parcial });
const erroDe = (r: ReturnType<typeof validarContato>, campo: keyof FormularioContatoDados) =>
  (r.ok ? undefined : r.erros[campo]);

describe('formulário de contato — obrigatórios', () => {
  it('vazio: nome, sobrenome, e-mail, idade e motivo são obrigatórios; telefone e horário não', () => {
    const r = validarContato(CONTATO_VAZIO);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erros.nome).toBe(MSG_CONTATO.nome);
    expect(r.erros.sobrenome).toBe(MSG_CONTATO.sobrenome);
    expect(r.erros.email).toBe(MSG_CONTATO.email);
    expect(r.erros.idade).toBe(MSG_CONTATO.idade);
    expect(r.erros.motivo).toBe(MSG_CONTATO.motivo);
    expect(r.erros.consentimento).toBe(MSG_CONTATO.consentimento);
    expect(r.erros.telefone).toBeUndefined();
    expect(r.erros.horario).toBeUndefined();
  });

  it('sem o consentimento (LGPD art. 11), não passa', () => {
    expect(erroDe(com({ consentimento: false }), 'consentimento')).toBe(MSG_CONTATO.consentimento);
  });

  it('só com os obrigatórios preenchidos, passa', () => {
    expect(validarContato(VALIDO).ok).toBe(true);
  });

  it('normaliza: espaços extras, e-mail em minúsculas, telefone mascarado, idade em número', () => {
    const r = com({ nome: '  Ana   Clara ', email: ' ANA@Exemplo.COM ', telefone: '11912345678', idade: '07' });
    expect(r.ok && r.dados).toMatchObject({ nome: 'Ana Clara', email: 'ana@exemplo.com', telefone: '(11) 91234-5678', idade: 7 });
  });
});

describe('formulário de contato — formatos', () => {
  it.each(['José', "D'Ávila", 'Ana-Luíza', 'Nguyễn', 'Müller'])('aceita o nome "%s"', (nome) => {
    expect(com({ nome }).ok).toBe(true);
  });

  it.each(['0', '121', '-5', '3.5', '30 anos', 'e3', '1e2'])('recusa a idade "%s"', (idade) => {
    expect(erroDe(com({ idade }), 'idade')).toBe(MSG_CONTATO.idade);
  });

  it.each(['1', '120'])('aceita a idade-limite %s', (idade) => {
    expect(com({ idade }).ok).toBe(true);
  });

  it.each(['(11) 1234-5678', '(00) 91234-5678', '1191234', '(11) 91234-56789', 'abc'])(
    'recusa o telefone "%s"', (telefone) => {
      expect(erroDe(com({ telefone }), 'telefone')).toBe(MSG_CONTATO.telefone);
    },
  );

  it.each(['(11) 3456-7890', '(21) 99876-5432', '+55 11 91234-5678'])('aceita o telefone "%s"', (telefone) => {
    expect(com({ telefone }).ok).toBe(true);
  });

  it.each(['maria', 'maria@', '@exemplo.com', 'maria@exemplo', 'ma ria@exemplo.com'])('recusa o e-mail "%s"', (email) => {
    expect(erroDe(com({ email }), 'email')).toBe(MSG_CONTATO.email);
  });

  it('motivo e horário só aceitam as opções da lista', () => {
    expect(erroDe(com({ motivo: 'qualquer-coisa' }), 'motivo')).toBe(MSG_CONTATO.motivo);
    expect(erroDe(com({ horario: 'madrugada' }), 'horario')).toBe(MSG_CONTATO.horario);
    expect(com({ horario: 'noite', motivo: 'outros' }).ok).toBe(true);
  });
});

describe('formulário de contato — segurança (lista de permitidos)', () => {
  const ATAQUES = [
    "' OR '1'='1",
    "Robert'); DROP TABLE appointment;--",
    '1; SELECT * FROM users',
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    'javascript:alert(1)',
    '{{7*7}}',
    '${process.env.AUTH_SECRET}',
    '../../etc/passwd',
    'https://phishing.exemplo/regularize',
  ];

  it.each(ATAQUES)('nome e sobrenome recusam "%s"', (ataque) => {
    expect(erroDe(com({ nome: ataque }), 'nome')).toBe(MSG_CONTATO.caracteres);
    expect(erroDe(com({ sobrenome: ataque }), 'sobrenome')).toBe(MSG_CONTATO.caracteres);
  });

  it.each(ATAQUES)('e-mail recusa "%s"', (ataque) => {
    expect(erroDe(com({ email: ataque }), 'email')).toBe(MSG_CONTATO.email);
  });

  it.each([
    '"x"@exemplo.com', 'a@exemplo.com;b@exemplo.com', 'a@exemplo.com<script>',
    "a'--@exemplo.com", 'a@exemplo.com\nBcc: vitima@exemplo.com',
  ])('e-mail recusa injeção/aspas: %j', (email) => {
    expect(erroDe(com({ email }), 'email')).toBe(MSG_CONTATO.email);
  });

  it.each(ATAQUES)('idade, telefone, motivo e horário recusam "%s"', (ataque) => {
    const r = com({ idade: ataque, telefone: ataque, motivo: ataque, horario: ataque });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erros).toMatchObject({
      idade: MSG_CONTATO.idade, telefone: MSG_CONTATO.telefone,
      motivo: MSG_CONTATO.motivo, horario: MSG_CONTATO.horario,
    });
  });

  it('nome que só tem pontuação permitida não passa', () => {
    expect(erroDe(com({ nome: "- . '" }), 'nome')).toBe(MSG_CONTATO.caracteres);
  });

  it('quebra de linha no nome não cria linha falsa na mensagem', () => {
    const r = com({ nome: 'Maria\nMotivo: Outros', sobrenome: 'Silva' });
    // O \n vira espaço; o ":" não é letra — recusado.
    expect(erroDe(r, 'nome')).toBe(MSG_CONTATO.caracteres);
    const semDoisPontos = com({ nome: 'Maria\r\nJosé' });
    expect(semDoisPontos.ok && semDoisPontos.dados.nome).toBe('Maria José');
  });

  it('caracteres invisíveis e bidi (U+202E, zero-width) saem antes de validar', () => {
    const r = com({ nome: 'Ma​ria‮', sobrenome: '⁦Silva⁩', email: 'maria​@exemplo.com' });
    expect(r.ok && r.dados).toMatchObject({ nome: 'Ma ria', sobrenome: 'Silva', email: 'maria@exemplo.com' });
  });

  it('limite de tamanho: nome com 61 letras é recusado', () => {
    expect(erroDe(com({ nome: 'a'.repeat(61) }), 'nome')).toBe(MSG_CONTATO.caracteres);
  });
});

describe('mensagem do WhatsApp', () => {
  it('personalizada com os dados do paciente e os rótulos da lista', () => {
    const r = com({ telefone: '21998765432', horario: 'tarde', motivo: 'ganho-de-massa' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(mensagemContato(r.dados)).toBe([
      `Olá, ${PROFISSIONAL.nomeCurto}! Gostaria de agendar uma consulta.`,
      '',
      'Nome: Maria da Silva',
      'Idade: 34 anos',
      'E-mail: maria@exemplo.com',
      'Telefone: (21) 99876-5432',
      'Preferência de horário: Tarde',
      'Motivo: Ganho de massa muscular',
    ].join('\n'));
  });

  it('opcionais vazios não geram linha; 1 ano no singular', () => {
    const r = com({ idade: '1' });
    if (!r.ok) throw new Error('deveria passar');
    const msg = mensagemContato(r.dados);
    expect(msg).toContain('Idade: 1 ano\n');
    expect(msg).not.toMatch(/Telefone|Preferência/);
    expect(msg.split('\n')).not.toContain('Telefone: ');
  });

  it('o link codifica a mensagem inteira: nada de &, # ou quebra de linha crua na URL', () => {
    const r = com({ nome: 'Ana', sobrenome: "D'Ávila" });
    if (!r.ok) throw new Error('deveria passar');
    const msg = mensagemContato(r.dados);
    const url = new URL(linkWhatsApp(msg));
    expect(url.origin).toBe('https://wa.me');
    expect([...url.searchParams.keys()]).toEqual(['text']);
    expect(url.searchParams.get('text')).toBe(msg);
    expect(url.href).not.toMatch(/[\n#]|&(?!$)/);
  });
});
