/**
 * Formulário de contato → WhatsApp. Não há servidor nem banco no caminho:
 * os dados saem do navegador direto para o wa.me. Mesmo assim a validação é
 * de LISTA DE PERMITIDOS, campo a campo — o que não é nome, e-mail, telefone,
 * idade ou uma das opções fechadas é recusado, então payloads de SQLi
 * (`' OR 1=1 --`), HTML/JS (`<script>`), quebra de linha para forjar linhas
 * na mensagem ou caracteres bidi para disfarçá-la simplesmente não passam.
 * A defesa não depende de "detectar ataque": depende de só aceitar o formato.
 *
 * Mensagens com causa E correção, como em lib/validation/agendamento.ts.
 */
import { z } from 'zod';
import { telefoneValido, mascararTelefone } from '../telefone';
import { FORMULARIO_CONTATO } from '../content/site';

export const MSG_CONTATO = {
  nome: 'Informe o seu nome.',
  sobrenome: 'Informe o seu sobrenome.',
  caracteres: 'Use só letras (acento, apóstrofo e hífen valem).',
  email: 'Informe um e-mail válido, ex.: nome@exemplo.com.',
  telefone: 'Informe o telefone com DDD, ex.: (11)\u00a091234\u20115678 — ou deixe em branco.',
  idade: 'Informe a idade em anos, só números (de 1 a 120).',
  motivo: 'Selecione o motivo da consulta.',
  horario: 'Escolha manhã, tarde ou noite — ou deixe sem escolher.',
} as const;

/** Limites que também vão como `maxLength` nos campos. */
export const LIMITES_CONTATO = { nome: 60, email: 254, telefone: 20, idade: 3 } as const;

/**
 * Controle (inclui \n e \r), formatação (zero-width, bidi como U+202E) e
 * separadores de linha Unicode. Saem ANTES de validar: um \n no nome criaria
 * uma linha falsa na mensagem ("Motivo: …"), e um U+202E inverteria o texto
 * exibido no WhatsApp da médica.
 */
const INVISIVEIS = /[\p{Cc}\p{Cf}\u2028\u2029]/gu;
const limpar = (v: string) => v.replace(INVISIVEIS, ' ').replace(/\s+/g, ' ');

/** Letras de qualquer alfabeto (com acento), espaço, apóstrofo, ponto e hífen. */
const NOME_PERMITIDO = /^[\p{L}\p{M}'\u2019. -]+$/u;
/** E-mail só em ASCII seguro: sem aspas, espaços, <>, ; ou comentários. */
const EMAIL_PERMITIDO = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

const IDS_MOTIVO = FORMULARIO_CONTATO.motivos.map((m) => m.id) as [string, ...string[]];
const IDS_HORARIO = FORMULARIO_CONTATO.horarios.map((h) => h.id) as [string, ...string[]];

const nome = (obrigatorio: string) => z.string()
  .overwrite(limpar).normalize('NFC').trim()
  .min(1, obrigatorio)
  .max(LIMITES_CONTATO.nome, MSG_CONTATO.caracteres)
  .regex(NOME_PERMITIDO, MSG_CONTATO.caracteres)
  // Precisa ter letra: "- . '" sozinho passaria na lista de permitidos.
  .refine((v) => /\p{L}/u.test(v), MSG_CONTATO.caracteres);

export const schemaContato = z.object({
  nome: nome(MSG_CONTATO.nome),
  sobrenome: nome(MSG_CONTATO.sobrenome),
  email: z.string().overwrite((v) => v.replace(INVISIVEIS, '')).trim().toLowerCase()
    .min(1, MSG_CONTATO.email)
    .max(LIMITES_CONTATO.email, MSG_CONTATO.email)
    .regex(EMAIL_PERMITIDO, MSG_CONTATO.email)
    .pipe(z.email(MSG_CONTATO.email)),
  // Opcional; se vier, é telefone brasileiro válido e sai sempre mascarado.
  telefone: z.string().overwrite((v) => v.replace(INVISIVEIS, '')).trim()
    .max(LIMITES_CONTATO.telefone, MSG_CONTATO.telefone)
    .refine((v) => v === '' || (/^[\d\s()+.-]+$/.test(v) && telefoneValido(v)), MSG_CONTATO.telefone)
    .transform((v) => (v === '' ? '' : mascararTelefone(v))),
  idade: z.string().trim()
    .regex(/^\d{1,3}$/, MSG_CONTATO.idade)
    .transform(Number)
    .refine((n) => n >= 1 && n <= 120, MSG_CONTATO.idade),
  horario: z.enum(['', ...IDS_HORARIO], MSG_CONTATO.horario),   // '' = sem preferência
  motivo: z.enum(IDS_MOTIVO, MSG_CONTATO.motivo),
});

/** O que o formulário guarda enquanto a pessoa digita (tudo texto). */
export type FormularioContatoDados = z.input<typeof schemaContato>;
/** O que sai da validação: limpo, normalizado e pronto para a mensagem. */
export type Contato = z.output<typeof schemaContato>;
export type CampoContato = keyof FormularioContatoDados;

export const CONTATO_VAZIO: FormularioContatoDados = {
  nome: '', sobrenome: '', email: '', telefone: '', idade: '', horario: '', motivo: '',
};

/** Valida tudo e devolve os dados limpos, ou o 1º erro de cada campo. */
export function validarContato(dados: FormularioContatoDados):
  { ok: true; dados: Contato } | { ok: false; erros: Partial<Record<CampoContato, string>> } {
  const r = schemaContato.safeParse(dados);
  if (r.success) return { ok: true, dados: r.data };
  const erros: Partial<Record<CampoContato, string>> = {};
  for (const issue of r.error.issues) {
    const campo = issue.path[0] as CampoContato;
    erros[campo] ??= issue.message;
  }
  return { ok: false, erros };
}
