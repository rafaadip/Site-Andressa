/**
 * Contraparte de lib/datetime.ts para o NAVEGADOR.
 *
 * Existe porque importar lib/datetime.ts no cliente arrastaria a Luxon
 * inteira para o bundle do /agendar. Aqui só há:
 *   - aritmética de CALENDÁRIO sobre strings 'YYYY-MM-DD' (sem fuso), e
 *   - FORMATAÇÃO via Intl.
 * Nenhuma conversão de fuso por offset — a regra nº 1 continua valendo.
 */
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;
const DIAS_LONGOS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'] as const;
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'] as const;

function partes(data: string): [number, number, number] {
  const [a, m, d] = data.split('-').map(Number);
  return [a!, m!, d!];
}

/** 'YYYY-MM-DD' + n dias → 'YYYY-MM-DD'. Aritmética de calendário, sem fuso. */
export function somarDias(data: string, n: number): string {
  const [a, m, d] = partes(data);
  const t = new Date(Date.UTC(a, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function rotuloDia(data: string, diaSemana: number) {
  const [, m, d] = partes(data);
  return {
    semana: DIAS_CURTOS[diaSemana] ?? '',
    semanaLonga: DIAS_LONGOS[diaSemana] ?? '',
    numero: d,
    mes: MESES_CURTOS[m - 1] ?? '',
    mesLongo: MESES_LONGOS[m - 1] ?? '',
  };
}

/** "segunda-feira, 15 de setembro" */
export function dataPorExtenso(data: string, diaSemana: number): string {
  const r = rotuloDia(data, diaSemana);
  return `${r.semanaLonga}, ${r.numero} de ${r.mesLongo}`;
}

/** Hora de um instante ISO no fuso informado — só formatação (Intl). */
export function horaNoFuso(iso: string, fuso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit', minute: '2-digit', timeZone: fuso,
  }).format(new Date(iso));
}

/**
 * Fuso do navegador, se ele difere do da clínica NO OFFSET (fusos com o
 * mesmo offset não interessam ao paciente). Usado só na teleconsulta.
 */
export function fusoDoPaciente(fusoClinica: string): string | null {
  try {
    const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!fuso || fuso === fusoClinica) return null;
    const agora = new Date().toISOString();
    return horaNoFuso(agora, fuso) === horaNoFuso(agora, fusoClinica) ? null : fuso;
  } catch {
    return null;
  }
}

/** "America/Cuiaba" → "Cuiaba" — rótulo curto e legível. */
export function nomeDoFuso(fuso: string): string {
  return (fuso.split('/').pop() ?? fuso).replace(/_/g, ' ');
}
