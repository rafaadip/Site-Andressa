import { describe, it, expect } from 'vitest';
import { Interval } from 'luxon';
import {
  normalizar, subtrair, expandirRegras, fatiar, calcularDisponibilidade,
  type RegraSemanal, type TipoConsulta,
} from '@/lib/availability/engine';
import { horaLocalParaUtc } from '@/lib/datetime';

const iv = (a: string, b: string) =>
  Interval.fromDateTimes(new Date(a), new Date(b));

const PRESENCIAL: TipoConsulta = {
  slug: 'consulta-presencial',
  duracaoMin: 40,
  bufferAntesMin: 0,
  bufferDepoisMin: 10,
  modalidade: 'in_person',
};

/** Terça, 14:00–18:00 na clínica. */
const REGRA_TERCA: RegraSemanal = {
  diaSemana: 2, horaInicio: '14:00', horaFim: '18:00', modalidade: 'in_person',
};

describe('subtrair — casos de borda', () => {
  const janela = [iv('2026-09-15T17:00:00Z', '2026-09-15T21:00:00Z')];

  it('ocupado idêntico à janela → janela some', () => {
    expect(subtrair(janela, [iv('2026-09-15T17:00:00Z', '2026-09-15T21:00:00Z')]))
      .toHaveLength(0);
  });

  it('ocupado engloba a janela → janela some', () => {
    expect(subtrair(janela, [iv('2026-09-15T16:00:00Z', '2026-09-15T22:00:00Z')]))
      .toHaveLength(0);
  });

  it('ocupado no meio → duas janelas', () => {
    const r = subtrair(janela, [iv('2026-09-15T18:00:00Z', '2026-09-15T19:00:00Z')]);
    expect(r).toHaveLength(2);
    expect(r[0]!.end!.toISO()).toBe(iv('2026-09-15T17:00:00Z', '2026-09-15T18:00:00Z').end!.toISO());
  });

  it('ocupado ENCOSTA no início (fim == início) → janela intacta', () => {
    // O caso que mais gera slot fantasma quando implementado à mão.
    const r = subtrair(janela, [iv('2026-09-15T16:00:00Z', '2026-09-15T17:00:00Z')]);
    expect(r).toHaveLength(1);
    expect(r[0]!.length('hours')).toBe(4);
  });

  it('ocupado de duração zero é ignorado', () => {
    const r = subtrair(janela, [iv('2026-09-15T18:00:00Z', '2026-09-15T18:00:00Z')]);
    expect(r).toHaveLength(1);
  });

  it('ocupados sobrepostos entre si são normalizados antes', () => {
    const r = subtrair(janela, [
      iv('2026-09-15T18:00:00Z', '2026-09-15T19:00:00Z'),
      iv('2026-09-15T18:30:00Z', '2026-09-15T20:00:00Z'),
    ]);
    expect(r).toHaveLength(2);
    expect(r[1]!.start!.toUTC().toISO()).toContain('20:00');
  });
});

describe('normalizar', () => {
  it('funde sobrepostos e ordena', () => {
    const r = normalizar([
      iv('2026-09-15T19:00:00Z', '2026-09-15T20:00:00Z'),
      iv('2026-09-15T17:00:00Z', '2026-09-15T19:30:00Z'),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0]!.length('hours')).toBe(3);
  });
});

describe('expandirRegras', () => {
  it('gera janela só nas terças do intervalo', () => {
    const j = expandirRegras('2026-09-14', '2026-09-27', [REGRA_TERCA], 'in_person');
    expect(j).toHaveLength(2); // 15/09 e 22/09
    expect(j[0]!.start!.toUTC().toISO()).toBe('2026-09-15T17:00:00.000Z');
  });

  it('ignora regra de outra modalidade', () => {
    expect(expandirRegras('2026-09-14', '2026-09-27', [REGRA_TERCA], 'telehealth'))
      .toHaveLength(0);
  });

  it('respeita validoDe / validoAte', () => {
    const regra = { ...REGRA_TERCA, validoDe: '2026-09-20' };
    const j = expandirRegras('2026-09-14', '2026-09-27', [regra], 'in_person');
    expect(j).toHaveLength(1); // só 22/09
  });
});

describe('fatiar', () => {
  const janela = [iv('2026-09-15T17:00:00Z', '2026-09-15T21:00:00Z')]; // 14h-18h

  it('inclui o buffer no passo: 40min + 10min → slots de 50 em 50', () => {
    // Janela 14:00-18:00 = 240 min; bloco = 40 + 10 = 50 min.
    // 4 blocos cabem (até 16:30→17:20). O 5º (17:20→18:10) estouraria.
    const s = fatiar(janela, PRESENCIAL, 5);
    expect(s.map((x) => x.rotulo)).toEqual(['14:00', '14:50', '15:40', '16:30']);
  });

  it('NÃO oferta slot cujo buffer final estoura a janela', () => {
    // Decisão de produto deliberada: o buffer da última consulta também
    // precisa caber. Garante que o expediente termina às 18:00 de fato,
    // em vez de a médica sair 18:10 todo dia.
    // Se um dia se quiser preencher esse resto, é política nova — não bug.
    const s = fatiar(janela, PRESENCIAL, 5);
    const ultimo = s[s.length - 1]!;
    const fimBloqueio = new Date(ultimo.fim.getTime() + PRESENCIAL.bufferDepoisMin * 60_000);
    expect(fimBloqueio.getTime())
      .toBeLessThanOrEqual(new Date('2026-09-15T21:00:00Z').getTime());
  });

  it('descarta slot cujo fim ultrapassa a janela', () => {
    // 17:20 + 50min = 18:10 > 18:00, então 17:20 NÃO deveria existir…
    // …mas o bloqueio de 17:20 termina 18:10. Verificamos o último válido.
    const s = fatiar([iv('2026-09-15T17:00:00Z', '2026-09-15T20:00:00Z')], PRESENCIAL, 5);
    const ultimo = s[s.length - 1]!;
    expect(ultimo.fim.getTime()).toBeLessThanOrEqual(new Date('2026-09-15T20:00:00Z').getTime());
  });

  it('janela menor que a duração não gera slot', () => {
    expect(fatiar([iv('2026-09-15T17:00:00Z', '2026-09-15T17:30:00Z')], PRESENCIAL, 5))
      .toHaveLength(0);
  });

  it('o horário exibido é o CLÍNICO, com buffer antes descontado', () => {
    const comBufferAntes = { ...PRESENCIAL, bufferAntesMin: 10 };
    const s = fatiar(janela, comBufferAntes, 5);
    expect(s[0]!.rotulo).toBe('14:10');
  });
});

describe('calcularDisponibilidade — pipeline', () => {
  const base = {
    de: '2026-09-14', ate: '2026-09-16',
    tipo: PRESENCIAL, regras: [REGRA_TERCA],
    excecoes: [], ocupadosExternos: [], ocupadosInternos: [],
    agora: new Date('2026-09-10T12:00:00Z'),
  };

  it('mantém dias sem vaga na resposta, com lista vazia', () => {
    const dias = calcularDisponibilidade(base);
    expect(dias.map((d) => d.data)).toEqual(['2026-09-14', '2026-09-15', '2026-09-16']);
    expect(dias[0]!.slots).toHaveLength(0); // segunda: sem regra
    expect(dias[1]!.slots.length).toBeGreaterThan(0); // terça
  });

  it('bloqueio por exceção remove os slots do período', () => {
    const dias = calcularDisponibilidade({
      ...base,
      excecoes: [{
        inicio: new Date('2026-09-15T17:00:00Z'),
        fim: new Date('2026-09-15T19:00:00Z'),
        tipo: 'block',
      }],
    });
    expect(dias[1]!.slots.map((s) => s.rotulo)).toEqual(['16:00', '16:50']);
  });

  it('exceção "extra" cria disponibilidade fora da regra semanal', () => {
    const dias = calcularDisponibilidade({
      ...base,
      excecoes: [{
        inicio: horaLocalParaUtc('2026-09-14', '09:00'),
        fim: horaLocalParaUtc('2026-09-14', '11:00'),
        tipo: 'extra',
      }],
    });
    expect(dias[0]!.slots.map((s) => s.rotulo)).toEqual(['09:00', '09:50']);
  });

  it('agenda pessoal do Google remove slots', () => {
    const dias = calcularDisponibilidade({
      ...base,
      ocupadosExternos: [iv('2026-09-15T17:00:00Z', '2026-09-15T20:00:00Z')],
    });
    expect(dias[1]!.slots.map((s) => s.rotulo)).toEqual(['17:00']);
  });

  it('lead time de 12h remove slots próximos demais', () => {
    const dias = calcularDisponibilidade({
      ...base,
      agora: new Date('2026-09-15T10:00:00Z'), // 07:00 local; 14:00 está a 7h
    });
    expect(dias[1]!.slots).toHaveLength(0);
  });

  it('horizonte de 60 dias corta o que está longe demais', () => {
    const dias = calcularDisponibilidade({
      ...base, de: '2026-12-01', ate: '2026-12-02',
      agora: new Date('2026-09-10T12:00:00Z'),
    });
    expect(dias.every((d) => d.slots.length === 0)).toBe(true);
  });

  it.each(['UTC', 'Asia/Tokyo', 'America/New_York'])(
    'produz resultado idêntico com TZ do servidor = %s', (tz) => {
      const original = process.env.TZ;
      try {
        process.env.TZ = tz;
        const dias = calcularDisponibilidade(base);
        expect(dias[1]!.slots.map((s) => s.rotulo))
          .toEqual(['14:00', '14:50', '15:40', '16:30']);
      } finally { process.env.TZ = original; }
    });
});
