import { executarCron } from '@/lib/api/cron';
import { receberDaAgenda } from '@/lib/calendar/receber';
import { practitionerId } from '@/lib/agendamento/servico';

export const dynamic = 'force-dynamic';

/**
 * A cada 15 min: lê o delta da agenda mesmo sem webhook — rede de
 * segurança para notificação perdida (FASE-05 §5).
 */
export function GET(req: Request) {
  return executarCron(req, 'sync-google', async () => receberDaAgenda(await practitionerId()));
}
