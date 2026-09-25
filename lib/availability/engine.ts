/**
 * Motor de disponibilidade — o núcleo do sistema.
 *
 * Função PURA: recebe regras, exceções e ocupações; devolve slots.
 * Não toca em banco nem em rede, para ser testável de forma exaustiva.
 *
 * Pipeline (docs/fases/FASE-04-motor-disponibilidade.md §2):
 *   1. expandir regras semanais em janelas locais → UTC
 *   2. aplicar exceções (block remove, extra adiciona)
 *   3. subtrair agenda pessoal (FreeBusy)
 *   4. subtrair agendamentos existentes
 *   5. fatiar em slots
 *   6. aplicar políticas (lead time, horizonte)
 */
import { Interval } from 'luxon';
import {
  TZ_CLINICA, diasNoIntervalo, horaLocalParaUtc, horaLocal, dataLocal,
  diaDaSemana, somarMinutos,
} from '../datetime';
import type { Modalidade } from '../config';

export type RegraSemanal = {
  /** 0=domingo … 6=sábado */
  diaSemana: number;
  /** 'HH:mm' no relógio da clínica */
  horaInicio: string;
  horaFim: string;
  modalidade: Modalidade;
  validoDe?: string | null;
  validoAte?: string | null;
};

export type Excecao = {
  inicio: Date;
  fim: Date;
  tipo: 'block' | 'extra';
};

export type TipoConsulta = {
  slug: string;
  duracaoMin: number;
  bufferAntesMin: number;
  bufferDepoisMin: number;
  modalidade: Modalidade;
};

export type Politicas = {
  /** Antecedência mínima, em horas. */
  leadTimeHoras: number;
  /** Horizonte máximo, em dias. */
  horizonteDias: number;
  /** Grade de alinhamento dos slots, em minutos. */
  grade: number;
};

export const POLITICAS_PADRAO: Politicas = {
  leadTimeHoras: 12,
  horizonteDias: 60,
  grade: 5,
};

export type Slot = { inicio: Date; fim: Date; rotulo: string };
export type DiaDisponivel = { data: string; diaSemana: number; slots: Slot[] };

export type EntradaMotor = {
  de: string;
  ate: string;
  tipo: TipoConsulta;
  regras: RegraSemanal[];
  excecoes: Excecao[];
  /** Compromissos pessoais vindos do FreeBusy do Google. */
  ocupadosExternos: Interval[];
  /** Agendamentos já existentes (intervalo BLOQUEADO, com buffers). */
  ocupadosInternos: Interval[];
  agora: Date;
  politicas?: Politicas;
  zona?: string;
};

/** Normaliza: ordena, funde sobrepostos e descarta vazios. */
export function normalizar(intervalos: Interval[]): Interval[] {
  const validos = intervalos
    .filter((i) => i.isValid && i.length('milliseconds') > 0)
    .sort((a, b) => a.start!.toMillis() - b.start!.toMillis());

  const fundidos: Interval[] = [];
  for (const atual of validos) {
    const ultimo = fundidos[fundidos.length - 1];
    // `abutsStart` (encostar) NÃO é sobreposição, mas fundir é seguro e
    // simplifica a subtração adiante.
    if (ultimo && atual.start! <= ultimo.end!) {
      fundidos[fundidos.length - 1] = Interval.fromDateTimes(
        ultimo.start!,
        atual.end! > ultimo.end! ? atual.end! : ultimo.end!,
      );
    } else {
      fundidos.push(atual);
    }
  }
  return fundidos;
}

/**
 * Subtrai `ocupados` de `janelas`.
 * Encostar (fim == início) NÃO remove nada — é o caso de borda que mais
 * gera slot fantasma quando implementado à mão.
 */
export function subtrair(janelas: Interval[], ocupados: Interval[]): Interval[] {
  const bloqueios = normalizar(ocupados);
  if (bloqueios.length === 0) return normalizar(janelas);

  return normalizar(janelas).flatMap((janela) =>
    janela.difference(...bloqueios).filter((r) => r.length('milliseconds') > 0),
  );
}

/** Passo 1 — expande regras semanais em janelas UTC. */
export function expandirRegras(
  de: string,
  ate: string,
  regras: RegraSemanal[],
  modalidade: Modalidade,
  zona: string = TZ_CLINICA,
): Interval[] {
  const janelas: Interval[] = [];

  for (const data of diasNoIntervalo(de, ate, zona)) {
    const dow = diaDaSemana(horaLocalParaUtc(data, '12:00', zona), zona);

    for (const regra of regras) {
      if (regra.diaSemana !== dow) continue;
      if (regra.modalidade !== modalidade) continue;
      if (regra.validoDe && data < regra.validoDe) continue;
      if (regra.validoAte && data > regra.validoAte) continue;

      janelas.push(Interval.fromDateTimes(
        horaLocalParaUtc(data, regra.horaInicio, zona),
        horaLocalParaUtc(data, regra.horaFim, zona),
      ));
    }
  }
  return normalizar(janelas);
}

/** Passo 5 — fatia janelas em slots do tamanho do tipo de consulta. */
export function fatiar(
  janelas: Interval[],
  tipo: TipoConsulta,
  grade: number,
  zona: string = TZ_CLINICA,
): Slot[] {
  // O intervalo BLOQUEADO inclui os buffers; o horário CLÍNICO é derivado.
  const bloqueioMin = tipo.bufferAntesMin + tipo.duracaoMin + tipo.bufferDepoisMin;
  const slots: Slot[] = [];

  for (const janela of janelas) {
    let cursor = janela.start!.toJSDate();

    while (true) {
      const fimBloqueio = somarMinutos(cursor, bloqueioMin);
      // Descarta slot cujo FIM ultrapassa a janela.
      if (fimBloqueio > janela.end!.toJSDate()) break;

      const inicioClinico = somarMinutos(cursor, tipo.bufferAntesMin);
      slots.push({
        inicio: inicioClinico,
        fim: somarMinutos(inicioClinico, tipo.duracaoMin),
        rotulo: horaLocal(inicioClinico, zona),
      });

      cursor = somarMinutos(cursor, Math.max(grade, bloqueioMin));
    }
  }
  return slots;
}

/** Pipeline completo. */
export function calcularDisponibilidade(e: EntradaMotor): DiaDisponivel[] {
  const zona = e.zona ?? TZ_CLINICA;
  const pol = e.politicas ?? POLITICAS_PADRAO;

  // 1. regras semanais
  let janelas = expandirRegras(e.de, e.ate, e.regras, e.tipo.modalidade, zona);

  // 2. exceções
  const bloqueios = e.excecoes
    .filter((x) => x.tipo === 'block')
    .map((x) => Interval.fromDateTimes(x.inicio, x.fim));
  const extras = e.excecoes
    .filter((x) => x.tipo === 'extra')
    .map((x) => Interval.fromDateTimes(x.inicio, x.fim));

  janelas = normalizar([...janelas, ...extras]);
  janelas = subtrair(janelas, bloqueios);

  // 3 e 4. agenda pessoal + agendamentos existentes
  janelas = subtrair(janelas, [...e.ocupadosExternos, ...e.ocupadosInternos]);

  // 5. fatiar
  const slots = fatiar(janelas, e.tipo, pol.grade, zona);

  // 6. políticas
  const minimo = somarMinutos(e.agora, pol.leadTimeHoras * 60);
  const maximo = somarMinutos(e.agora, pol.horizonteDias * 24 * 60);
  const validos = slots.filter((s) => s.inicio >= minimo && s.inicio <= maximo);

  // Agrupa por dia local, mantendo dias vazios (informação, não ausência).
  const porDia = new Map<string, Slot[]>();
  for (const data of diasNoIntervalo(e.de, e.ate, zona)) porDia.set(data, []);
  for (const slot of validos) {
    porDia.get(dataLocal(slot.inicio, zona))?.push(slot);
  }

  return [...porDia.entries()].map(([data, lista]) => ({
    data,
    diaSemana: diaDaSemana(horaLocalParaUtc(data, '12:00', zona), zona),
    slots: lista.sort((a, b) => a.inicio.getTime() - b.inicio.getTime()),
  }));
}
