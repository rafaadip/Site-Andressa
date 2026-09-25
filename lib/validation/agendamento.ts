/**
 * Schema ÚNICO: o formulário valida campo a campo com ele, e a API valida
 * o corpo inteiro com ele. Não há como os dois divergirem.
 *
 * Mensagens com causa E correção (ui-ux-pro-max §8, `error-clarity`).
 */
import { z } from 'zod';
import { normalizarTelefone, telefoneValido } from '../telefone';

export const MSG = {
  nome: 'Informe nome e sobrenome.',
  // U+2011 (hífen inseparável): o exemplo não quebra no meio.
  telefone: 'Informe o telefone com DDD, ex.: (11)\u00a091234\u20115678.',
  email: 'Informe um e-mail válido, ex.: nome@exemplo.com.',
  motivo: 'Use até 500 caracteres.',
  consentimentoDados: 'Para agendar, é preciso autorizar o uso dos seus dados.',
  consentimentoSaude: 'Autorize o registro do motivo, ou deixe o campo em branco.',
} as const;

export const campos = {
  nome: z.string().trim()
    .min(5, MSG.nome)
    .max(120, MSG.nome)
    .refine((v) => v.split(/\s+/).filter((p) => p.length >= 2).length >= 2, MSG.nome),
  telefone: z.string().refine(telefoneValido, MSG.telefone),
  email: z.string().trim().toLowerCase().pipe(z.email(MSG.email)),
  motivo: z.string().trim().max(500, MSG.motivo),
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
