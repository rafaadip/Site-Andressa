/**
 * Validação de ambiente — falhar cedo e com mensagem clara.
 *
 * Dividido POR ÁREA: o agendamento precisa só de banco e sal; exigir as
 * credenciais do Google e da Resend aqui impediria o site de subir sem
 * elas. Cada módulo pede apenas o que usa, e cada integração tem um
 * `…Configurado()` que responde sem lançar.
 *
 * Ver docs/fases/FASE-02-fundacao-projeto.md §3
 */
import { z } from 'zod';
import { PROFISSIONAL } from './config';

function validar<T extends z.ZodTypeAny>(nome: string, schema: T): z.infer<T> {
  const r = schema.safeParse(process.env);
  if (!r.success) {
    const faltando = r.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Ambiente inválido (${nome}):\n${faltando}\n\nVer .env.example`);
  }
  return r.data;
}

const cache = new Map<string, unknown>();
function memo<T>(chave: string, fn: () => T): T {
  if (!cache.has(chave)) cache.set(chave, fn());
  return cache.get(chave) as T;
}

/** Só para testes: o ambiente muda entre casos. */
export function _limparCacheEnv() { cache.clear(); }

const vazio = (v: string | undefined) => !v || v.trim() === '';

export const envBanco = () => memo('banco', () => validar('banco', z.object({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'Precisa ser uma URL postgres://'),
})));

export const envSeguranca = () => memo('seguranca', () => validar('segurança', z.object({
  TOKEN_SALT: z.string().min(16, 'Mínimo 16 caracteres — openssl rand -hex 16'),
})));

/** Sessão do /admin. Sem isto, o painel fica fechado (não quebra o site). */
export const envAuth = () => memo('auth', () => validar('admin', z.object({
  AUTH_SECRET: z.string().min(32, 'Mínimo 32 caracteres — openssl rand -base64 32'),
  ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email()),
})));

export function adminConfigurado(): boolean {
  return !vazio(process.env.AUTH_SECRET) && !vazio(process.env.ADMIN_EMAIL)
    && googleConfigurado();
}

export const envGoogle = () => memo('google', () => validar('google', z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALENDAR_ID: z.string().default('primary'),
  GOOGLE_WEBHOOK_TOKEN: z.string().min(16, 'Mínimo 16 caracteres — openssl rand -hex 16'),
  ENCRYPTION_KEY: z.string().refine(
    (v) => Buffer.from(v, 'base64').length === 32,
    'Precisa ser 32 bytes em base64 — openssl rand -base64 32',
  ),
})));

/** Credenciais do app OAuth presentes? (Conectar a agenda é outro passo.) */
export function googleConfigurado(): boolean {
  return !vazio(process.env.GOOGLE_CLIENT_ID) && !vazio(process.env.GOOGLE_CLIENT_SECRET);
}

export const envEmail = () => memo('email', () => validar('e-mail', z.object({
  RESEND_API_KEY: z.string().startsWith('re_'),
  EMAIL_FROM: z.string().min(3),
  EMAIL_REPLY_TO: z.string().optional(),
  /** Segredo `whsec_…` do webhook da Resend (bounce/reclamação). */
  RESEND_WEBHOOK_SECRET: z.string().optional(),
})));

export function emailConfigurado(): boolean {
  return /^re_/.test(process.env.RESEND_API_KEY ?? '') && !vazio(process.env.EMAIL_FROM);
}

/** Rotas de cron exigem `Authorization: Bearer $CRON_SECRET` (FASE-13 §4). */
export function segredoCron(): string | null {
  const s = process.env.CRON_SECRET;
  return s && s.length >= 16 ? s : null;
}

/** Para onde vão os avisos à médica (nova consulta, agenda desconectada…). */
export function emailDaMedica(): string {
  return (process.env.ADMIN_EMAIL?.trim() || PROFISSIONAL.email).toLowerCase();
}

/**
 * Ambiente de produção DE VERDADE (Vercel production). Preview e local não
 * são — e nunca podem tocar a agenda real (FASE-13 §1).
 */
export function ehProducao(): boolean {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production';
  return process.env.NODE_ENV === 'production';
}
