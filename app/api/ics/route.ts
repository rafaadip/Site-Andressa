import { icsPorToken } from '@/lib/agendamento/servico';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ics?t=<token> — o compromisso para o calendário do paciente.
 * Pelo TOKEN, nunca pelo id: o .ics tem nome e e-mail do paciente.
 * REQUEST enquanto ativo; CANCEL depois de cancelado (remove do iPhone).
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('t') ?? '';
  const ics = await icsPorToken(token).catch(() => null);
  if (!ics) return new Response('Não encontrado', { status: 404 });

  const metodo = ics.includes('METHOD:CANCEL') ? 'CANCEL' : 'REQUEST';
  return new Response(ics, {
    headers: {
      'Content-Type': `text/calendar; charset=utf-8; method=${metodo}`,
      'Content-Disposition': 'attachment; filename="consulta-dra-andressa.ics"',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
