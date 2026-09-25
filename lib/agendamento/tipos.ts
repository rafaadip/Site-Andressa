/**
 * Contratos públicos da API de agendamento — compartilhados com o navegador.
 * Nada aqui importa código de servidor.
 */
import type { Modalidade } from '../config';

export type TipoConsultaPublico = {
  slug: string;
  label: string;
  duracaoMin: number;
  modalidade: Modalidade;
};

export type SlotPublico = { inicio: string; rotulo: string };
export type DiaPublico = { data: string; diaSemana: number; slots: SlotPublico[] };

export type RespostaDisponibilidade = {
  timezone: string;
  hoje: string;
  tipo: TipoConsultaPublico;
  dias: DiaPublico[];
  /** true quando a agenda externa falhou e servimos sem ela (ADR-002). */
  degradado: boolean;
};

export type AgendamentoConfirmado = {
  id: string;
  inicio: string;
  fim: string;
  /** "segunda-feira, 15 de setembro às 14:00" */
  quando: string;
  tipo: string;
  modalidade: Modalidade;
  local: string;
  urlGestao: string;
  urlIcs: string;
  urlGoogle: string;
};

export type ErroApi = {
  erro: 'VALIDACAO' | 'SLOT_INDISPONIVEL' | 'LIMITE' | 'TIPO_INEXISTENTE'
      | 'IDEMPOTENCIA' | 'INDISPONIVEL' | 'INTERNO';
  mensagem: string;
  campos?: Record<string, string>;
};
