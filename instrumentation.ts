/**
 * Erros não tratados de qualquer rota (página, API, Server Action) passam
 * por aqui: logados SEM dado pessoal e reportados ao Sentry, se houver DSN.
 */
import type { Instrumentation } from 'next';

export const onRequestError: Instrumentation.onRequestError = async (erro, req, ctx) => {
  const { log } = await import('./lib/log');
  // Só o caminho (sem query: /api/ics?t=<token> vazaria o token) e o tipo de rota.
  log.excecao('next.erro-nao-tratado', erro, {
    caminho: req.path.split('?')[0],
    metodo: req.method,
    rota: ctx.routePath,
    tipoRota: ctx.routeType,
  });
};
