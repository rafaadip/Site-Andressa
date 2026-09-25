import { after } from 'next/server';
import { envEmail, emailConfigurado } from '@/lib/env';
import { assinaturaValida, processarEventoResend } from '@/lib/email/webhook';
import { processarFila } from '@/lib/notificacoes/fila';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

/** POST /api/webhooks/resend — bounce e reclamação de e-mail. */
export async function POST(req: Request) {
  const segredo = emailConfigurado() ? envEmail().RESEND_WEBHOOK_SECRET : undefined;
  if (!segredo) return new Response(null, { status: 404 });

  const corpo = await req.text();
  if (corpo.length > 64 * 1024) return new Response(null, { status: 413 });
  const ok = assinaturaValida({
    segredo,
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    assinaturas: req.headers.get('svix-signature'),
    corpo,
  });
  if (!ok) return new Response(null, { status: 401 });

  try {
    const r = await processarEventoResend(JSON.parse(corpo));
    if (r === 'marcado') after(() => processarFila().then(() => undefined));
  } catch (e) {
    log.excecao('resend.webhook', e);
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
