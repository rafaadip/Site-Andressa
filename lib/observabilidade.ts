/**
 * Relato de erros ao Sentry SEM o SDK — um POST no endpoint de envelope.
 *
 * Por que sem SDK: o @sentry/nextjs instrumenta o build inteiro e captura
 * corpo de requisição por padrão; aqui o que sai é só o que mandamos, já
 * sem PII (FASE-13 §5). Sem SENTRY_DSN, não faz nada.
 *
 * DSN: https://<chave>@<host>/<projeto>
 */
import { mascararTexto } from './pii';

type Dsn = { chave: string; host: string; projeto: string; protocolo: string };

function lerDsn(): Dsn | null {
  const bruto = process.env.SENTRY_DSN;
  if (!bruto) return null;
  try {
    const u = new URL(bruto);
    const projeto = u.pathname.replace(/^\//, '');
    if (!u.username || !projeto) return null;
    return { chave: u.username, host: u.host, projeto, protocolo: u.protocol };
  } catch {
    return null;
  }
}

export async function reportarAoSentry(
  evento: string, e: unknown, extra: Record<string, unknown> = {},
): Promise<void> {
  const dsn = lerDsn();
  if (!dsn) return;

  const erro = e instanceof Error ? e : new Error(String(e));
  const id = crypto.randomUUID().replace(/-/g, '');
  const corpo = {
    event_id: id,
    timestamp: Date.now() / 1000,
    platform: 'node',
    level: 'error',
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    transaction: evento,
    tags: { evento },
    extra,
    exception: {
      values: [{
        type: erro.name,
        // A mensagem pode conter dado do paciente: mascarada.
        value: mascararTexto(erro.message).slice(0, 500),
        stacktrace: erro.stack ? {
          frames: erro.stack.split('\n').slice(1, 30).reverse()
            .map((l) => ({ function: mascararTexto(l.trim()).slice(0, 200) })),
        } : undefined,
      }],
    },
  };

  const envelope = [
    JSON.stringify({ event_id: id, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(corpo),
  ].join('\n');

  try {
    await fetch(`${dsn.protocolo}//${dsn.host}/api/${dsn.projeto}/envelope/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${dsn.chave}, sentry_client=site-andressa/1.0`,
      },
      body: envelope,
      signal: AbortSignal.timeout(3_000),
    });
  } catch { /* observabilidade nunca derruba a requisição */ }
}
