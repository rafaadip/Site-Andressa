import { z } from 'zod';
import { disponibilidade, practitionerId } from '@/lib/agendamento/servico';
import { agendamentoOnlineHabilitado } from '@/lib/calendar/freebusy';
import { dataLocal } from '@/lib/datetime';
import { erro, SEM_CACHE, traduzirErro } from '@/lib/api/respostas';

export const dynamic = 'force-dynamic';

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const consulta = z.object({
  tipo: z.string().regex(/^[a-z0-9-]{2,60}$/),
  de: z.string().regex(DATA).optional(),
  ate: z.string().regex(DATA).optional(),
});

/** GET /api/disponibilidade?tipo=consulta-presencial&de=2026-09-14&ate=2026-09-27 */
export async function GET(req: Request) {
  const p = consulta.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!p.success) return erro(422, { erro: 'VALIDACAO', mensagem: 'Parâmetros inválidos.' });

  const hoje = dataLocal(new Date());
  const de = p.data.de ?? hoje;
  const ate = p.data.ate ?? de;
  if (de < hoje) return erro(422, { erro: 'VALIDACAO', mensagem: 'A data inicial já passou.' });

  try {
    if (!(await agendamentoOnlineHabilitado(await practitionerId()))) {
      return erro(503, { erro: 'INDISPONIVEL', mensagem: 'Agendamento online indisponível. Fale pelo WhatsApp.' });
    }
    return Response.json(await disponibilidade({ tipo: p.data.tipo, de, ate }), { headers: SEM_CACHE });
  } catch (e) {
    return traduzirErro(e);
  }
}
