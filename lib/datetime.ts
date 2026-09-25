/**
 * ÚNICO módulo autorizado a converter fuso horário.
 *
 * Regra inviolável nº 1 (docs/DOCUMENTACAO.md §6):
 * nenhum outro arquivo faz aritmética de offset. O ESLint proíbe
 * `getTimezoneOffset()` e somas do tipo `+ 3 * 3600000`.
 *
 * Por quê: o Brasil não tem horário de verão desde o Decreto 9.772/2019,
 * então `UTC-3` está correto HOJE. Se o horário de verão voltar, todo
 * agendamento futuro sairia uma hora deslocado — em silêncio, sem erro
 * em log algum. Base IANA resolve por construção.
 *
 * Ver docs/fases/FASE-04-motor-disponibilidade.md §3
 */
import { DateTime, Interval } from 'luxon';
import { PROFISSIONAL } from './config';

export const TZ_CLINICA = PROFISSIONAL.timezone;

export class DataInvalidaError extends Error {
  constructor(detalhe: string) {
    super(`Data/hora inválida: ${detalhe}`);
    this.name = 'DataInvalidaError';
  }
}

/**
 * "toda terça às 14:00 local" → instante UTC daquela terça específica.
 *
 * @param data  'YYYY-MM-DD' no calendário local da clínica
 * @param hora  'HH:mm' no relógio de parede da clínica
 */
export function horaLocalParaUtc(
  data: string,
  hora: string,
  zona: string = TZ_CLINICA,
): Date {
  const dt = DateTime.fromISO(`${data}T${hora}`, { zone: zona });
  if (!dt.isValid) throw new DataInvalidaError(`${data}T${hora} @ ${zona}`);
  return dt.toUTC().toJSDate();
}

/** Instante UTC → 'YYYY-MM-DD' no calendário da clínica. */
export function dataLocal(instante: Date, zona: string = TZ_CLINICA): string {
  return DateTime.fromJSDate(instante).setZone(zona).toISODate()!;
}

/** Instante UTC → 'HH:mm' no relógio da clínica. Rótulo de slot. */
export function horaLocal(instante: Date, zona: string = TZ_CLINICA): string {
  return DateTime.fromJSDate(instante).setZone(zona).toFormat('HH:mm');
}

/** 0=domingo … 6=sábado, no calendário da clínica. */
export function diaDaSemana(instante: Date, zona: string = TZ_CLINICA): number {
  // Luxon usa 1=segunda … 7=domingo; normalizamos para o padrão JS.
  return DateTime.fromJSDate(instante).setZone(zona).weekday % 7;
}

/** "segunda-feira, 15 de setembro às 14:00" */
export function formatarParaPaciente(
  instante: Date,
  zona: string = TZ_CLINICA,
): string {
  return DateTime.fromJSDate(instante)
    .setZone(zona)
    .setLocale('pt-BR')
    .toFormat("cccc, d 'de' LLLL 'às' HH:mm");
}

/** "seg, 15/09 às 14:00" — versão curta para WhatsApp e resumo. */
export function formatarCurto(instante: Date, zona: string = TZ_CLINICA): string {
  return DateTime.fromJSDate(instante)
    .setZone(zona)
    .setLocale('pt-BR')
    .toFormat("ccc, dd/MM 'às' HH:mm");
}

/** "quinta-feira, 11 de setembro" — cabeçalho de dia no painel. */
export function formatarDia(instante: Date, zona: string = TZ_CLINICA): string {
  return DateTime.fromJSDate(instante).setZone(zona).setLocale('pt-BR').toFormat("cccc, d 'de' LLLL");
}

/** 'YYYY-MM-DD' local + n dias (aritmética de calendário, sem offset). */
export function somarDiasLocal(data: string, n: number, zona: string = TZ_CLINICA): string {
  const dt = DateTime.fromISO(data, { zone: zona });
  if (!dt.isValid) throw new DataInvalidaError(data);
  return dt.plus({ days: n }).toISODate()!;
}

/**
 * Fim do dia local `data` (= 00:00 do dia seguinte), como instante UTC.
 * Dia com horário de verão tem 23 ou 25 h: `início + 24 h` erra por uma
 * hora exatamente na virada — usar SEMPRE isto para janelas de dia local.
 */
export function fimDoDiaLocal(data: string, zona: string = TZ_CLINICA): Date {
  return horaLocalParaUtc(somarDiasLocal(data, 1, zona), '00:00', zona);
}

/** Formato compacto UTC do RFC 5545: 20260915T170000Z */
export function emUtcCompacto(instante: Date): string {
  return DateTime.fromJSDate(instante).toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
}

/** Formato compacto LOCAL do RFC 5545 (usado com TZID): 20260915T140000 */
export function emLocalCompacto(instante: Date, zona: string = TZ_CLINICA): string {
  return DateTime.fromJSDate(instante).setZone(zona).toFormat("yyyyLLdd'T'HHmmss");
}

/** Lista de datas 'YYYY-MM-DD' de `de` até `ate`, inclusive, no fuso da clínica. */
export function diasNoIntervalo(
  de: string,
  ate: string,
  zona: string = TZ_CLINICA,
): string[] {
  const inicio = DateTime.fromISO(de, { zone: zona }).startOf('day');
  const fim = DateTime.fromISO(ate, { zone: zona }).startOf('day');
  if (!inicio.isValid || !fim.isValid) throw new DataInvalidaError(`${de}..${ate}`);
  if (fim < inicio) return [];

  const dias: string[] = [];
  let cursor = inicio;
  while (cursor <= fim) {
    dias.push(cursor.toISODate()!);
    cursor = cursor.plus({ days: 1 });
  }
  return dias;
}

/** Soma minutos a um instante. Seguro: opera sobre o instante, não sobre a parede. */
export function somarMinutos(instante: Date, minutos: number): Date {
  return DateTime.fromJSDate(instante).plus({ minutes: minutos }).toJSDate();
}

/**
 * Arredonda PARA CIMA ao próximo múltiplo de `grade` minutos do relógio da
 * clínica: 14:07 com grade 5 → 14:10; 14:10 fica 14:10. Segundos contam
 * (14:10:30 → 14:15). É o relógio de PAREDE que se alinha, não o UTC — em
 * fuso com offset quebrado (+05:45) o slot ainda cai em :00, :05…
 */
export function alinharAGrade(instante: Date, grade: number, zona: string = TZ_CLINICA): Date {
  const g = Math.max(1, Math.floor(grade));
  let dt = DateTime.fromJSDate(instante).setZone(zona);
  if (dt.second || dt.millisecond) dt = dt.startOf('minute').plus({ minutes: 1 });
  const resto = (dt.hour * 60 + dt.minute) % g;
  return (resto ? dt.plus({ minutes: g - resto }) : dt).toJSDate();
}

export { DateTime, Interval };
