import { PROFISSIONAL } from './config';
import { digitosNacionais } from './telefone';
import { FORMULARIO_CONTATO } from './content/site';
import type { Contato } from './validation/contato';

/** Só os dígitos, no formato que o wa.me espera: 5511998053826 */
const WHATSAPP = PROFISSIONAL.telefone.replace(/\D/g, '');

/** Link do WhatsApp, opcionalmente com mensagem pré-preenchida. */
export function linkWhatsApp(mensagem?: string): string {
  const base = `https://wa.me/${WHATSAPP}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}

export const MENSAGEM_AGENDAMENTO =
  `Olá, ${PROFISSIONAL.nomeCurto}! Gostaria de agendar uma consulta.`;

/**
 * Mensagem do formulário de contato, personalizada com os dados do paciente.
 * Recebe SÓ dados que já passaram por schemaContato (lista de permitidos):
 * motivo e horário viram o rótulo da lista fechada, nunca o valor enviado.
 * Campos opcionais vazios não geram linha.
 */
export function mensagemContato(c: Contato): string {
  const M = FORMULARIO_CONTATO.mensagem;
  const rotulo = <T extends { id: string; rotulo: string }>(lista: readonly T[], id: string) =>
    lista.find((i) => i.id === id)?.rotulo;
  const horario = rotulo(FORMULARIO_CONTATO.horarios, c.horario);
  const motivo = rotulo(FORMULARIO_CONTATO.motivos, c.motivo);

  const linhas = [
    `Olá, ${PROFISSIONAL.nomeCurto}! ${M.abertura}`,
    '',
    `${M.nome}: ${c.nome} ${c.sobrenome}`,
    `${M.idade}: ${c.idade} ${c.idade === 1 ? 'ano' : 'anos'}`,
    `${M.email}: ${c.email}`,
    c.telefone ? `${M.telefone}: ${c.telefone}` : null,
    horario ? `${M.horario}: ${horario}` : null,
    motivo ? `${M.motivo}: ${motivo}` : null,
  ];
  return linhas.filter((l): l is string => l !== null).join('\n');
}

/**
 * WhatsApp DO PACIENTE, para a médica responder pelo painel. Recebe o
 * telefone já validado e mascarado; sem telefone, não há link.
 */
export function linkWhatsAppDoPaciente(telefone: string | null): string | null {
  if (!telefone) return null;
  const nacional = digitosNacionais(telefone);
  return nacional.length === 10 || nacional.length === 11 ? `https://wa.me/55${nacional}` : null;
}
