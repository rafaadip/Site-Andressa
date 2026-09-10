/**
 * Gerador de iCalendar (RFC 5545).
 *
 * Componente de primeira classe, não utilitário: o Apple Calendar é o cliente
 * mais rigoroso do mercado e FALHA EM SILÊNCIO quando algo está fora do RFC —
 * não há mensagem de erro, o evento simplesmente não aparece.
 *
 * Ver docs/fases/FASE-06-ics-calendario-paciente.md
 */
import { PROFISSIONAL, localConsulta, type Modalidade } from '../config';
import { emUtcCompacto, emLocalCompacto, TZ_CLINICA } from '../datetime';

const CRLF = '\r\n';

export type DadosIcs = {
  /** UID ESTÁVEL por agendamento. Nunca Date.now(). */
  uid: string;
  /** Incrementa a cada alteração; sem isso clientes DESCARTAM o update. */
  sequence: number;
  inicio: Date;
  fim: Date;
  tipoLabel: string;
  modalidade: Modalidade;
  pacienteNome: string;
  pacienteEmail: string;
  organizadorEmail: string;
  urlGestao?: string;
};

/**
 * RFC 5545 §3.1 — dobra linhas em 75 OCTETOS (não caracteres: UTF-8 conta bytes).
 * Continuações começam com um espaço.
 */
export function dobrar(linha: string): string {
  const bytes = Buffer.from(linha, 'utf8');
  if (bytes.length <= 75) return linha;

  const partes: string[] = [];
  let inicio = 0;
  while (inicio < bytes.length) {
    const limite = inicio === 0 ? 75 : 74; // continuação gasta 1 byte com o espaço
    let fim = Math.min(inicio + limite, bytes.length);
    // Não cortar no meio de um code point UTF-8 (continuação = 10xxxxxx).
    while (fim > inicio + 1 && fim < bytes.length && (bytes[fim]! & 0xc0) === 0x80) {
      fim--;
    }
    partes.push((inicio === 0 ? '' : ' ') + bytes.subarray(inicio, fim).toString('utf8'));
    inicio = fim;
  }
  return partes.join(CRLF);
}

/** RFC 5545 §3.3.11 — a ordem importa: barra invertida PRIMEIRO. */
export function escapar(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * VTIMEZONE de America/Sao_Paulo no regime atual (UTC-3 fixo desde o
 * Decreto 9.772/2019).
 *
 * TODO(dst): se o horário de verão voltar, acrescentar componente DAYLIGHT
 * com RRULE. Como usamos TZID (e não UTC convertido), clientes com base tz
 * atualizada corrigem sozinhos — este bloco é o fallback.
 */
const VTIMEZONE_SAO_PAULO = [
  'BEGIN:VTIMEZONE',
  `TZID:${TZ_CLINICA}`,
  `X-LIC-LOCATION:${TZ_CLINICA}`,
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0300',
  'TZOFFSETTO:-0300',
  'TZNAME:-03',
  'DTSTART:19700101T000000',
  'END:STANDARD',
  'END:VTIMEZONE',
];

function descricao(d: DadosIcs): string {
  const linhas = [
    `Paciente: ${d.pacienteNome}`,
    `Profissional: ${PROFISSIONAL.nome} — ${PROFISSIONAL.crm}`,
    '',
    `Em caso de imprevisto, avise pelo WhatsApp ${PROFISSIONAL.telefoneExibicao}.`,
  ];
  if (d.urlGestao) linhas.push('', `Remarcar ou cancelar: ${d.urlGestao}`);
  return linhas.join('\n');
}

export function gerarIcs(d: DadosIcs, metodo: 'REQUEST' | 'CANCEL'): string {
  const local = localConsulta(d.modalidade);

  const linhas: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dra Andressa Correia//Agendamento//PT-BR',
    'CALSCALE:GREGORIAN',
    `METHOD:${metodo}`,
    ...VTIMEZONE_SAO_PAULO,
    'BEGIN:VEVENT',
    `UID:${d.uid}`,
    `SEQUENCE:${d.sequence}`,
    `DTSTAMP:${emUtcCompacto(new Date())}`,
    `DTSTART;TZID=${TZ_CLINICA}:${emLocalCompacto(d.inicio)}`,
    `DTEND;TZID=${TZ_CLINICA}:${emLocalCompacto(d.fim)}`,
    dobrar(`SUMMARY:${escapar(`${d.tipoLabel} — ${PROFISSIONAL.nomeCurto}`)}`),
    dobrar(`DESCRIPTION:${escapar(descricao(d))}`),
    dobrar(`LOCATION:${escapar(local)}`),
    `STATUS:${metodo === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE',
    dobrar(`ORGANIZER;CN=${escapar(PROFISSIONAL.nomeCurto)}:mailto:${d.organizadorEmail}`),
    dobrar(`ATTENDEE;CN=${escapar(d.pacienteNome)};RSVP=FALSE:mailto:${d.pacienteEmail}`),
  ];

  if (metodo === 'REQUEST') {
    linhas.push(
      'BEGIN:VALARM',
      'TRIGGER:-PT2H',
      'ACTION:DISPLAY',
      'DESCRIPTION:Lembrete de consulta',
      'END:VALARM',
    );
  }

  linhas.push('END:VEVENT', 'END:VCALENDAR');
  return linhas.join(CRLF) + CRLF;
}

/** UID estável, gerado uma vez na criação do agendamento. */
export function novoUid(): string {
  return `${crypto.randomUUID()}@draandressacorreia.com.br`;
}

/**
 * Link "Adicionar ao Google Agenda" — para quem usa Google no navegador,
 * um .ics é fricção desnecessária.
 */
export function linkGoogleCalendar(d: DadosIcs): string {
  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', `${d.tipoLabel} — ${PROFISSIONAL.nomeCurto}`);
  url.searchParams.set('dates', `${emUtcCompacto(d.inicio)}/${emUtcCompacto(d.fim)}`);
  url.searchParams.set('details', descricao(d));
  url.searchParams.set('location', localConsulta(d.modalidade));
  url.searchParams.set('ctz', TZ_CLINICA);
  return url.toString();
}
