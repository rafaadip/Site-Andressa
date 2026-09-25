import { executarCron } from '@/lib/api/cron';
import { aplicarRetencao } from '@/lib/lgpd/retencao';

export const dynamic = 'force-dynamic';

/** Diário às 05:00 UTC = 02:00 em Brasília (FASE-10 §3.5). */
export function GET(req: Request) {
  return executarCron(req, 'retencao', () => aplicarRetencao());
}
