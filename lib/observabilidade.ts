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
import { codigoPg } from './db/reservas';

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

/**
 * O que sai do erro. Erro de banco vira SÓ o SQLSTATE: o Drizzle monta
 * `Failed query: <sql>\nparams: <valores>`, e os valores são nome, motivo,
 * recado — o `mascararTexto` só pega e-mail, telefone e token (SEC-07).
 */
export function resumoDoErro(erro: Error): string {
  const pg = codigoPg(erro);
  if (pg) return `postgres ${pg}`;
  return mascararTexto(erro.message.split('\n')[0] ?? '').slice(0, 200);
}

/** Só as linhas `at …` do stack: as outras repetem a mensagem (e os params). */
export function quadrosDoStack(erro: Error) {
  return (erro.stack ?? '').split('\n').filter((l) => /^\s+at /.test(l)).slice(0, 30).reverse()
    .map((l) => ({ function: mascararTexto(l.trim()).slice(0, 200) }));
}

/**
 * Teto por instância: qualquer um provoca erro de propósito, e sem teto a
 * cota do Sentry acaba e os erros reais somem (SEC-11). Por minuto: 5 do
 * mesmo evento+tipo e 30 no total.
 */
const TETO = { porChave: 5, total: 30, janelaMs: 60_000 };
let janela = { inicio: 0, total: 0, porChave: new Map<string, number>() };

function dentroDoTeto(chave: string, agora = Date.now()): boolean {
  if (agora - janela.inicio >= TETO.janelaMs) janela = { inicio: agora, total: 0, porChave: new Map() };
  const n = janela.porChave.get(chave) ?? 0;
  if (n >= TETO.porChave || janela.total >= TETO.total) return false;
  janela.porChave.set(chave, n + 1);
  janela.total++;
  return true;
}

/** Testes: zera o teto. */
export function _limparTetoSentry() { janela = { inicio: 0, total: 0, porChave: new Map() }; }

export async function reportarAoSentry(
  evento: string, e: unknown, extra: Record<string, unknown> = {},
): Promise<void> {
  const dsn = lerDsn();
  if (!dsn) return;

  const erro = e instanceof Error ? e : new Error(String(e));
  if (!dentroDoTeto(`${evento}|${erro.name}`)) return;
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
        // A mensagem pode conter dado do paciente: só o resumo, mascarado.
        value: resumoDoErro(erro),
        stacktrace: erro.stack ? { frames: quadrosDoStack(erro) } : undefined,
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
