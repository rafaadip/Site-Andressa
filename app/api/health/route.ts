import { verificarSaudeEmCache } from '@/lib/saude';
import { autorizadoCron } from '@/lib/api/cron';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health — 200 ok/degradado · 503 sem banco. Sem dado pessoal.
 *
 * Em público, só `{ status }`: o detalhe dizia a qualquer um quando a agenda
 * caiu (janela D+2) e quando os e-mails falham (SEC-14). O detalhe completo
 * sai com `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const s = await verificarSaudeEmCache();
  return Response.json(autorizadoCron(req) ? s : { status: s.status }, {
    status: s.banco ? 200 : 503,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}
