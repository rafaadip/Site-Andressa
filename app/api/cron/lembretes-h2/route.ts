import { executarCron } from '@/lib/api/cron';
import { lembretesH2 } from '@/lib/notificacoes/lembretes';

export const dynamic = 'force-dynamic';

/** De hora em hora. */
export function GET(req: Request) {
  return executarCron(req, 'lembretes-h2', () => lembretesH2());
}
