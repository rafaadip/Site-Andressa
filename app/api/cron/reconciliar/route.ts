import { executarCron } from '@/lib/api/cron';
import { reconciliar } from '@/lib/calendar/sincronizar';

export const dynamic = 'force-dynamic';

/** A cada 5 min: consultas `pending`/`failed` → agenda do Google (FASE-05 §6). */
export function GET(req: Request) {
  return executarCron(req, 'reconciliar', () => reconciliar());
}
