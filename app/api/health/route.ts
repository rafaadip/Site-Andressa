import { verificarSaude } from '@/lib/saude';

export const dynamic = 'force-dynamic';

/** GET /api/health — 200 ok/degradado · 503 sem banco. Sem dado pessoal. */
export async function GET() {
  const s = await verificarSaude();
  return Response.json(s, {
    status: s.banco ? 200 : 503,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}
