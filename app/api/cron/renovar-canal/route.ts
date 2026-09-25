import { executarCron } from '@/lib/api/cron';
import { renovarCanalSePreciso } from '@/lib/calendar/canal';
import { practitionerId } from '@/lib/agendamento/servico';

export const dynamic = 'force-dynamic';

/** Diário: canal push expira em ~30 dias; renova com 3 de folga. */
export function GET(req: Request) {
  return executarCron(req, 'renovar-canal', async () => renovarCanalSePreciso(await practitionerId()));
}
