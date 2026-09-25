/**
 * Erros não tratados de qualquer rota (página, API, Server Action) passam
 * por aqui: logados SEM dado pessoal e reportados ao Sentry, se houver DSN.
 */
import type { Instrumentation } from 'next';

/**
 * Ruído que qualquer um provoca: POST de Server Action com id inexistente
 * ou de outra origem. O Next já recusa; não é erro nosso (SEC-11).
 */
const RUIDO = /Failed to find Server Action|Invalid Server Actions request/;

export const onRequestError: Instrumentation.onRequestError = async (erro, req, ctx) => {
  const { log } = await import('./lib/log');
  if (erro instanceof Error && RUIDO.test(erro.message)) {
    log.aviso('next.server-action-recusada', { caminho: req.path.split('?')[0], metodo: req.method });
    return;
  }
  // Só o caminho (sem query: /api/ics?t=<token> vazaria o token) e o tipo de rota.
  log.excecao('next.erro-nao-tratado', erro, {
    caminho: req.path.split('?')[0],
    metodo: req.method,
    rota: ctx.routePath,
    tipoRota: ctx.routeType,
  });
};
