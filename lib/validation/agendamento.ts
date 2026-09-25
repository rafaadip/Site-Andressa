/**
 * Schema ÚNICO: o formulário valida campo a campo com ele, e a API valida
 * o corpo inteiro com ele. Não há como os dois divergirem.
 *
 * Mensagens com causa E correção (ui-ux-pro-max §8, `error-clarity`).
 */
import { z } from 'zod';
import { normalizarTelefone, telefoneValido } from '../telefone';

/**
 * Versão do texto de consentimento exibido no formulário (FASE-10 §3.3).
 * Mudou o texto em lib/content/site.ts (CONSENTIMENTO)? Suba a versão: cada
 * agendamento registra qual texto a pessoa aceitou.
 */
export const VERSAO_CONSENTIMENTO = '2026-09-25';

export const MSG = {
  nome: 'Informe nome e sobrenome.',
  // U+2011 (hífen inseparável): o exemplo não quebra no meio.
  telefone: 'Informe o telefone com DDD, ex.: (11)\u00a091234\u20115678.',
  email: 'Informe um e-mail válido, ex.: nome@exemplo.com.',
  motivo: 'Use até 500 caracteres.',
  nomeCaracteres: 'Use só letras no nome (acento, apóstrofo e hífen valem).',
  consentimentoDados: 'Para agendar, é preciso autorizar o uso dos seus dados.',
  consentimentoSaude: 'Autorize o registro do motivo, ou deixe o campo em branco.',
} as const;

/**
 * Nome só com letras (qualquer alfabeto, com acento), espaço, apóstrofo,
 * ponto e hífen. O nome sai em e-mail do domínio da médica, no `.ics` e no
 * evento da agenda dela: aceitar URL ou "regularize seu cadastro" fazia do
 * site um relay de phishing assinado (SEC-05).
 */
const NOME_PERMITIDO = /^[\p{L}\p{M}'\u2019. -]+$/u;
/**
 * Invisíveis: controle, formatação (zero-width etc.) e separadores de linha
 * Unicode. No nome viram espaço; no motivo saem (menos quebra de linha e
 * tab). O byte NUL chegava ao Postgres e virava 500 (SEC-11) — e ninguém
 * consegue apagar o que não vê, então saneamos em vez de recusar.
 */
const INVISIVEIS_NOME = /[\p{Cc}\p{Cf}\u2028\u2029]/gu;
const INVISIVEIS_MOTIVO = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u2028\u2029]/g;

export const campos = {
  nome: z.string().overwrite((v) => v.replace(INVISIVEIS_NOME, ' ').replace(/\s+/g, ' ')).normalize('NFC').trim()
    .min(5, MSG.nome)
    .max(120, MSG.nome)
    .regex(NOME_PERMITIDO, MSG.nomeCaracteres)
    .refine((v) => v.split(' ').filter((p) => p.length >= 2).length >= 2, MSG.nome),
  telefone: z.string().refine(telefoneValido, MSG.telefone),
  email: z.string().trim().toLowerCase().pipe(z.email(MSG.email)),
  motivo: z.string().overwrite((v) => v.replace(/\r\n?/g, '\n').replace(INVISIVEIS_MOTIVO, ''))
    .normalize('NFC').trim().max(500, MSG.motivo),
  consentimentoDados: z.literal(true, { error: MSG.consentimentoDados }),
  consentimentoSaude: z.boolean(),
};

export const schemaDadosPaciente = z.object({
  nome: campos.nome,
  telefone: campos.telefone.transform(normalizarTelefone),
  email: campos.email,
  motivo: campos.motivo.default(''),
  consentimentoDados: campos.consentimentoDados,
  consentimentoSaude: campos.consentimentoSaude.default(false),
}).superRefine((d, ctx) => {
  // Motivo é DADO DE SAÚDE (LGPD Art. 11): exige consentimento próprio.
  if (d.motivo && !d.consentimentoSaude) {
    ctx.addIssue({ code: 'custom', path: ['consentimentoSaude'], message: MSG.consentimentoSaude });
  }
});

export const schemaCriarAgendamento = z.object({
  tipo: z.string().regex(/^[a-z0-9-]{2,60}$/),
  inicio: z.iso.datetime({ offset: true }),
  /** Honeypot: humano não vê, robô preenche. */
  site: z.string().max(0).optional(),
  paciente: schemaDadosPaciente,
});

export type CriarAgendamento = z.infer<typeof schemaCriarAgendamento>;

/** Erros por campo, no formato { campo: mensagem } que o formulário exibe. */
export function errosPorCampo(erro: z.ZodError): Record<string, string> {
  const r: Record<string, string> = {};
  for (const i of erro.issues) {
    const chave = String(i.path[i.path.length - 1] ?? '_');
    r[chave] ??= i.message;
  }
  return r;
}

const DOMINIOS_COMUNS: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.con': 'gmail.com',
  'gamil.com': 'gmail.com', 'gmail.com.br': 'gmail.com',
  'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com',
  'yahoo.con': 'yahoo.com', 'icloud.con': 'icloud.com',
};

/** "ana@gmial.com" → "ana@gmail.com". Sugestão, nunca correção automática. */
export function sugerirEmail(email: string): string | null {
  const [usuario, dominio] = email.trim().toLowerCase().split('@');
  if (!usuario || !dominio) return null;
  const certo = DOMINIOS_COMUNS[dominio];
  return certo ? `${usuario}@${certo}` : null;
}
