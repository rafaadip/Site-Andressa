import { timingSafeEqual } from 'node:crypto';
import { after } from 'next/server';
import { envGoogle, googleConfigurado } from '@/lib/env';
import { conexaoAtiva } from '@/lib/calendar/conexao';
import { receberDaAgenda } from '@/lib/calendar/receber';
import { reconciliar } from '@/lib/calendar/sincronizar';
import { processarFila } from '@/lib/notificacoes/fila';
import { practitionerId } from '@/lib/agendamento/servico';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

function iguais(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * POST /api/webhooks/google — o Google avisa que ALGO mudou na agenda.
 *
 * Contra replay e falsificação (docs/00-ARQUITETURA.md §9): token secreto
 * do canal E o par canal/recurso precisam bater com o canal registrado.
 * Resposta rápida; o trabalho (listar o delta) roda depois, em `after()`.
 */
export async function POST(req: Request) {
  if (!googleConfigurado()) return new Response(null, { status: 404 });
  const h = req.headers;
  const token = h.get('x-goog-channel-token') ?? '';
  if (!iguais(token, envGoogle().GOOGLE_WEBHOOK_TOKEN)) return new Response(null, { status: 401 });

  const pid = await practitionerId();
  const conexao = await conexaoAtiva(pid);
  if (!conexao || conexao.channelId !== h.get('x-goog-channel-id')
      || conexao.channelResourceId !== h.get('x-goog-resource-id')) {
    // Canal antigo/parado: 404 faz o Google desistir dele.
    return new Response(null, { status: 404 });
  }

  // Handshake inicial do canal.
  if (h.get('x-goog-resource-state') === 'sync') return new Response(null, { status: 200 });

  after(async () => {
    try {
      const r = await receberDaAgenda(pid);
      log.info('google.webhook', { ...r });
      await reconciliar();
      await processarFila();
    } catch (e) {
      log.excecao('google.webhook', e);
    }
  });
  return new Response(null, { status: 200 });
}
