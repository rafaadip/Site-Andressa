/**
 * Validação de ambiente na inicialização — falhar cedo, não em produção às 22h.
 * Ver docs/fases/FASE-02-fundacao-projeto.md §3
 */
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.url(),
  AUTH_SECRET: z.string().min(32),
  ADMIN_EMAIL: z.email(),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALENDAR_ID: z.string().default('primary'),
  GOOGLE_WEBHOOK_TOKEN: z.string().min(16),
  ENCRYPTION_KEY: z.string().length(44, 'Precisa ser 32 bytes em base64'),
  TOKEN_SALT: z.string().min(16),
  RESEND_API_KEY: z.string().startsWith('re_'),
  EMAIL_FROM: z.string().min(1),
  CRON_SECRET: z.string().min(16),
  NEXT_PUBLIC_SITE_URL: z.url(),
});

export type Env = z.infer<typeof schema>;

let cache: Env | null = null;

/**
 * Lê e valida o ambiente. Chamada preguiçosa para que build e testes
 * não exijam todas as variáveis.
 */
export function env(): Env {
  if (cache) return cache;
  const r = schema.safeParse(process.env);
  if (!r.success) {
    const faltando = r.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Ambiente inválido:\n${faltando}\n\nVer .env.example`);
  }
  cache = r.data;
  return cache;
}
