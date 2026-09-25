/**
 * Efeitos externos de uma escrita (evento no Google + e-mails), disparados
 * DEPOIS da resposta ao paciente — via `after()` nos handlers.
 *
 * Nada aqui pode falhar a requisição: se o Google ou a Resend estiverem
 * fora, a consulta já está gravada e o cron reprocessa (ADR-002).
 */
import { sincronizarAgendamento } from '../calendar/sincronizar';
import { processarFila } from '../notificacoes/fila';
import { log } from '../log';

export async function efeitosDe(appointmentId: string): Promise<void> {
  try {
    await sincronizarAgendamento(appointmentId);
  } catch (e) {
    log.excecao('efeitos.google', e, { agendamento: appointmentId });
  }
  try {
    await processarFila({ appointmentId });
  } catch (e) {
    log.excecao('efeitos.email', e, { agendamento: appointmentId });
  }
}
