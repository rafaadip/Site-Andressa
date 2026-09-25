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

/** Constrói um Interval a partir de dois instantes. */
export function intervalo(inicio: Date, fim: Date): Interval {
  return Interval.fromDateTimes(inicio, fim);
}

/** Soma minutos a um instante. Seguro: opera sobre o instante, não sobre a parede. */
export function somarMinutos(instante: Date, minutos: number): Date {
  return DateTime.fromJSDate(instante).plus({ minutes: minutos }).toJSDate();
}

/**
 * Fuso do navegador do paciente, quando difere do da clínica.
 * Usado na teleconsulta para mostrar "14:00 (Brasília) · 13:00 no seu horário".
 * Retorna `null` quando é o mesmo fuso ou não dá para detectar.
 */
export function fusoDoPaciente(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz || tz === TZ_CLINICA) return null;
    // Fusos diferentes com o mesmo offset não interessam ao paciente.
    const agora = DateTime.now();
    if (agora.setZone(tz).offset === agora.setZone(TZ_CLINICA).offset) return null;
    return tz;
  } catch {
    return null;
  }
}

export { DateTime, Interval };
