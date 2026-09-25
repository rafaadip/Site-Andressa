import { PROFISSIONAL } from './config';

/** Só os dígitos, no formato que o wa.me espera: 5511998053826 */
const WHATSAPP = PROFISSIONAL.telefone.replace(/\D/g, '');

/** Link do WhatsApp, opcionalmente com mensagem pré-preenchida. */
export function linkWhatsApp(mensagem?: string): string {
  const base = `https://wa.me/${WHATSAPP}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}

export const MENSAGEM_AGENDAMENTO =
  `Olá, ${PROFISSIONAL.nomeCurto}! Gostaria de agendar uma consulta.`;
