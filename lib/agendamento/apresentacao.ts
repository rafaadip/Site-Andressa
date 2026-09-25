/**
 * Como um agendamento do banco vira coisa que o paciente vê: link de
 * gestão, .ics, link do Google Agenda, contexto dos e-mails.
 *
 * Compartilhado pelo serviço, pela fila de e-mails e pela sincronização —
 * um lugar só decide, por exemplo, se o link de cancelar ainda vale.
 */
import { schema } from '../db';
import { PROFISSIONAL, localConsulta, type Modalidade } from '../config';
import { formatarCurto, formatarParaPaciente } from '../datetime';
import { linkGoogleCalendar, type DadosIcs } from '../calendar/ics';
import { linkWhatsApp } from '../contato';
import { tokenGestaoPara } from '../seguranca';
import { urlSite } from '../seo';
import type { CtxConsulta, CtxMedica } from '../email/templates';

export type Linha = typeof schema.appointment.$inferSelect;
export type LinhaTipo = typeof schema.appointmentType.$inferSelect;
export type LinhaProfissional = typeof schema.practitioner.$inferSelect;

/**
 * Token do link de gestão. Recomputável (HMAC de id + Idempotency-Key com o
 * sal do servidor): no banco fica só o hash, e é assim que o e-mail
 * enviado depois ainda consegue levar o link.
 */
export function tokenDe(ag: Pick<Linha, 'id' | 'idempotencyKey'>): string | null {
  return ag.idempotencyKey ? tokenGestaoPara(ag.id, ag.idempotencyKey) : null;
}

export function urlGestaoDe(ag: Pick<Linha, 'id' | 'idempotencyKey'>): string | null {
  const t = tokenDe(ag);
  return t ? `${urlSite()}/consulta/${t}` : null;
}

export function dadosIcs(ag: Linha, tipoLabel: string, modalidade: Modalidade, urlGestao?: string): DadosIcs {
  return {
    uid: ag.icsUid,
    sequence: ag.icsSequence,
    inicio: ag.visitStartsAt,
    fim: ag.visitEndsAt,
    tipoLabel,
    modalidade,
    pacienteNome: ag.patientName,
    pacienteEmail: ag.patientEmail,
    organizadorEmail: PROFISSIONAL.email,
    urlGestao,
  };
}

/** O paciente ainda pode cancelar sozinho, pelo link? */
export function podeCancelarPeloLink(ag: Pick<Linha, 'status' | 'visitStartsAt'>, prazoHoras: number, agora = new Date()): boolean {
  const horasAte = (ag.visitStartsAt.getTime() - agora.getTime()) / 3_600_000;
  return ag.status === 'confirmed' && horasAte >= prazoHoras;
}

export function ctxConsulta(
  ag: Linha, tipo: Pick<LinhaTipo, 'label' | 'durationMin' | 'locationKind'>, prof: LinhaProfissional, agora = new Date(),
): CtxConsulta {
  const modalidade = tipo.locationKind as Modalidade;
  const urlGestao = urlGestaoDe(ag);
  return {
    nome: ag.patientName,
    quando: formatarParaPaciente(ag.visitStartsAt),
    quandoCurto: formatarCurto(ag.visitStartsAt),
    tipo: tipo.label,
    modalidade,
    local: localConsulta(modalidade),
    duracaoMin: tipo.durationMin,
    urlGestao: urlGestao ?? `${urlSite()}/`,
    urlGoogle: linkGoogleCalendar(dadosIcs(ag, tipo.label, modalidade, urlGestao ?? undefined)),
    urlAgendar: `${urlSite()}/agendar`,
    urlWhatsApp: linkWhatsApp(
      `Olá, ${PROFISSIONAL.nomeCurto}! Sobre minha consulta de ${formatarCurto(ag.visitStartsAt)} (${ag.patientName}):`),
    telehealthUrl: modalidade === 'telehealth' ? prof.telehealthUrl : null,
    mapsUrl: modalidade === 'in_person' ? PROFISSIONAL.endereco?.mapsUrl ?? null : null,
    podeCancelarPeloLink: Boolean(urlGestao) && podeCancelarPeloLink(ag, prof.cancelDeadlineHours, agora),
    prazoCancelamentoHoras: prof.cancelDeadlineHours,
  };
}

export function ctxMedica(ag: Linha, tipo: Pick<LinhaTipo, 'label' | 'locationKind'>, pagina = '/admin'): CtxMedica {
  return {
    nome: ag.patientName,
    telefone: ag.patientPhone,
    email: ag.patientEmail,
    quando: formatarParaPaciente(ag.visitStartsAt),
    tipo: tipo.label,
    local: localConsulta(tipo.locationKind as Modalidade),
    comMotivo: Boolean(ag.patientNote),
    urlPainel: `${urlSite()}${pagina}`,
  };
}
