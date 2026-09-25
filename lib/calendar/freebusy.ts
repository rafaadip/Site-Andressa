/**
 * Agenda pessoal da médica (Google FreeBusy) — FASE-05.
 *
 * Até a FASE-05, não há fonte externa: a disponibilidade vem só das regras
 * semanais, das exceções e dos agendamentos do banco. Isso significa que
 * um PLANTÃO marcado só no celular dela NÃO bloqueia horário no site.
 * Por isso produção exige opt-in explícito (ver `agendamentoOnlineHabilitado`).
 */
import type { Interval } from 'luxon';
import { googleConfigurado } from '../env';

export type ResultadoOcupados = { intervalos: Interval[]; degradado: boolean };

export async function buscarOcupadosExternos(_de: Date, _ate: Date): Promise<ResultadoOcupados> {
  if (googleConfigurado()) {
    // TODO(FASE-05): freebusy.query com cache e degradação (ADR-002).
    console.warn('[freebusy] Google configurado, mas a integração é da FASE-05. Ignorando.');
  }
  return { intervalos: [], degradado: false };
}

/**
 * O agendamento online pode ser oferecido?
 *
 * Sem Google Calendar, o site ofertaria horários em que a médica está de
 * plantão — o pior defeito possível do produto (ADR-002). Em produção isso
 * só é permitido com decisão CONSCIENTE: AGENDAMENTO_SEM_GOOGLE=aceito.
 * Sem ela, /agendar cai no WhatsApp.
 */
export function agendamentoOnlineHabilitado(): boolean {
  if (googleConfigurado()) return true;
  if (process.env.AGENDAMENTO_SEM_GOOGLE === 'aceito') return true;
  return process.env.NODE_ENV !== 'production';
}
