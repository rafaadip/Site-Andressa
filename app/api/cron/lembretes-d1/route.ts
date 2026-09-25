import { executarCron } from '@/lib/api/cron';
import { lembretesD1 } from '@/lib/notificacoes/lembretes';

export const dynamic = 'force-dynamic';

/** Diário às 21:00 UTC = 18:00 em Brasília. */
export function GET(req: Request) {
  return executarCron(req, 'lembretes-d1', () => lembretesD1());
}
