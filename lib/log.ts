/**
 * Log estruturado (uma linha JSON por evento) com PII REMOVIDA
 * (lib/pii.ts). Regra: nome, e-mail, telefone, motivo da consulta e tokens
 * nunca chegam ao log nem ao Sentry (docs/00-ARQUITETURA.md §9).
 */
import { limparPii } from './pii';
import { reportarAoSentry } from './observabilidade';

type Nivel = 'info' | 'aviso' | 'erro';

function emitir(nivel: Nivel, evento: string, dados?: Record<string, unknown>) {
  const linha = JSON.stringify({ nivel, evento, ...(limparPii(dados ?? {}) as object), em: new Date().toISOString() });
  if (nivel === 'erro') console.error(linha);
  else if (nivel === 'aviso') console.warn(linha);
  else if (process.env.NODE_ENV !== 'test') console.log(linha);
}

export const log = {
  info: (evento: string, dados?: Record<string, unknown>) => emitir('info', evento, dados),
  aviso: (evento: string, dados?: Record<string, unknown>) => emitir('aviso', evento, dados),
  erro: (evento: string, dados?: Record<string, unknown>) => emitir('erro', evento, dados),
  /** Erro inesperado: loga SÓ o tipo (a mensagem pode carregar PII) e reporta. */
  excecao: (evento: string, e: unknown, dados?: Record<string, unknown>) => {
    const tipo = e instanceof Error ? e.name : typeof e;
    emitir('erro', evento, { ...dados, tipo });
    void reportarAoSentry(evento, e, limparPii(dados ?? {}) as Record<string, unknown>);
  },
};
