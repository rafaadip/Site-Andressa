import type { ErroApi } from '../agendamento/tipos';
import {
  AgendamentoInexistenteError, IdempotenciaConflitanteError, LimiteExcedidoError, PrazoCancelamentoError,
  SlotIndisponivelError, TipoInexistenteError,
} from '../agendamento/servico';
import { DataInvalidaError } from '../datetime';
import { log } from '../log';

/** Nada de agendamento em cache: um horário recém-ocupado não pode reaparecer. */
export const SEM_CACHE = { 'Cache-Control': 'private, no-store' } as const;

export function erro(status: number, corpo: ErroApi, headers: Record<string, string> = {}) {
  return Response.json(corpo, { status, headers: { ...SEM_CACHE, ...headers } });
}

/** Erro de domínio → HTTP. Qualquer outra coisa é 500 e vai para o log. */
export function traduzirErro(e: unknown): Response {
  if (e instanceof SlotIndisponivelError)
    return erro(409, { erro: 'SLOT_INDISPONIVEL', mensagem: e.message });
  if (e instanceof LimiteExcedidoError)
    return erro(429, { erro: 'LIMITE', mensagem: e.message }, { 'Retry-After': '600' });
  if (e instanceof TipoInexistenteError)
    return erro(404, { erro: 'TIPO_INEXISTENTE', mensagem: e.message });
  if (e instanceof AgendamentoInexistenteError)
    return erro(404, { erro: 'NAO_ENCONTRADO', mensagem: e.message });
  if (e instanceof IdempotenciaConflitanteError)
    return erro(422, { erro: 'IDEMPOTENCIA', mensagem: e.message });
  if (e instanceof PrazoCancelamentoError)
    return erro(409, { erro: 'LIMITE', mensagem: e.message });
  if (e instanceof DataInvalidaError)
    return erro(422, { erro: 'VALIDACAO', mensagem: 'Período inválido.' });

  // Nunca ecoar o erro interno: pode carregar dados do paciente.
  log.excecao('api.erro-inesperado', e);
  return erro(500, {
    erro: 'INTERNO',
    mensagem: 'Não conseguimos concluir agora. Tente de novo ou fale pelo WhatsApp.',
  });
}
