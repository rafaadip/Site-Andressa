/**
 * Rotas de cron (FASE-13 §4): só com `Authorization: Bearer $CRON_SECRET`.
 * A Vercel envia esse cabeçalho sozinha quando CRON_SECRET está definido.
 * Sem o segredo configurado, as rotas ficam FECHADAS (nunca abertas).
 */
import { timingSafeEqual } from 'node:crypto';
import { segredoCron } from '../env';
import { log } from '../log';

export function autorizadoCron(req: Request): boolean {
  const segredo = segredoCron();
  if (!segredo) return false;
  const recebido = Buffer.from(req.headers.get('authorization') ?? '');
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

/** Envelopa um job: autoriza, mede, loga e nunca vaza erro interno. */
export async function executarCron(req: Request, nome: string, job: () => Promise<unknown>): Promise<Response> {
  if (!autorizadoCron(req)) return new Response('Não autorizado', { status: 401 });
  const inicio = Date.now();
  try {
    const resultado = await job();
    log.info(`cron.${nome}`, { ms: Date.now() - inicio, resultado });
    return Response.json({ ok: true, resultado }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    log.excecao(`cron.${nome}`, e);
    return Response.json({ ok: false }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
