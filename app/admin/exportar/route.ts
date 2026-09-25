import { sessaoAtual } from '@/lib/auth/admin';
import { exportarTitular, paraCsv } from '@/lib/agendamento/admin';

export const dynamic = 'force-dynamic';

/** GET /admin/exportar?email=…&formato=json|csv — portabilidade (LGPD Art. 18, V). */
export async function GET(req: Request) {
  if (!(await sessaoAtual())) return new Response('Não autorizado', { status: 401 });
  const url = new URL(req.url);
  const email = (url.searchParams.get('email') ?? '').trim().toLowerCase();
  if (!email || email.length > 254) return new Response('Informe o e-mail', { status: 422 });

  const dados = await exportarTitular(email);
  const csv = url.searchParams.get('formato') === 'csv';
  const nome = `dados-titular-${new Date().toISOString().slice(0, 10)}.${csv ? 'csv' : 'json'}`;
  return new Response(csv ? `﻿${paraCsv(dados)}` : JSON.stringify(dados, null, 2), {
    headers: {
      'Content-Type': csv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
