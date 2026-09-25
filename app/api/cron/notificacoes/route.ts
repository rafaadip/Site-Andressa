import { executarCron } from '@/lib/api/cron';
import { processarFila } from '@/lib/notificacoes/fila';

export const dynamic = 'force-dynamic';

/** A cada 5 min: reenvia e-mails que falharam (backoff na própria fila). */
export function GET(req: Request) {
  return executarCron(req, 'notificacoes', () => processarFila({ limite: 50 }));
}
