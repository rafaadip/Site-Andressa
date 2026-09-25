import { schemaCriarAgendamento, errosPorCampo } from '@/lib/validation/agendamento';
import { criarAgendamento } from '@/lib/agendamento/servico';
import { agendamentoOnlineHabilitado } from '@/lib/calendar/freebusy';
import { ipDaRequisicao } from '@/lib/seguranca';
import { erro, SEM_CACHE, traduzirErro } from '@/lib/api/respostas';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TAMANHO_MAXIMO = 8 * 1024;

/**
 * POST /api/agendamentos
 * Header obrigatório: Idempotency-Key (UUID v4 gerado no navegador).
 */
export async function POST(req: Request) {
  if (!agendamentoOnlineHabilitado()) {
    return erro(503, { erro: 'INDISPONIVEL', mensagem: 'Agendamento online indisponível. Fale pelo WhatsApp.' });
  }

  const chave = req.headers.get('idempotency-key') ?? '';
  if (!UUID.test(chave)) {
    return erro(400, { erro: 'VALIDACAO', mensagem: 'Idempotency-Key ausente ou inválida.' });
  }

  const texto = await req.text();
  if (texto.length > TAMANHO_MAXIMO) {
    return erro(413, { erro: 'VALIDACAO', mensagem: 'Requisição grande demais.' });
  }

  let corpo: unknown;
  try { corpo = JSON.parse(texto); } catch {
    return erro(400, { erro: 'VALIDACAO', mensagem: 'JSON inválido.' });
  }

  const p = schemaCriarAgendamento.safeParse(corpo);
  if (!p.success) {
    return erro(422, { erro: 'VALIDACAO', mensagem: 'Revise os campos destacados.', campos: errosPorCampo(p.error) });
  }

  try {
    const r = await criarAgendamento(p.data, { ip: ipDaRequisicao(req.headers), idempotencyKey: chave });
    return Response.json(r.agendamento, { status: r.repetido ? 200 : 201, headers: SEM_CACHE });
  } catch (e) {
    return traduzirErro(e);
  }
}
