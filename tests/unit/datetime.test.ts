import { describe, it, expect } from 'vitest';
import {
  horaLocalParaUtc, dataLocal, horaLocal, diaDaSemana,
  diasNoIntervalo, emUtcCompacto, emLocalCompacto, DataInvalidaError,
} from '@/lib/datetime';

describe('horaLocalParaUtc', () => {
  it('converte hora de parede da clínica para o instante UTC correto', () => {
    // Brasil sem horário de verão: UTC-3 → 14:00 local = 17:00Z
    expect(horaLocalParaUtc('2026-09-15', '14:00').toISOString())
      .toBe('2026-09-15T17:00:00.000Z');
  });

  it('rejeita data inválida em vez de produzir "Invalid Date" silencioso', () => {
    expect(() => horaLocalParaUtc('2026-02-30', '14:00')).toThrow(DataInvalidaError);
    expect(() => horaLocalParaUtc('2026-09-15', '25:00')).toThrow(DataInvalidaError);
  });
});

describe('independência do fuso do SERVIDOR', () => {
  // Se o TZ do processo influenciar a saída, o sistema está errado —
  // mesmo que o resultado pareça certo em desenvolvimento.
  const zonas = ['UTC', 'America/Sao_Paulo', 'Asia/Tokyo', 'America/New_York'];

  it.each(zonas)('produz o mesmo instante com TZ=%s', (tz) => {
    const original = process.env.TZ;
    try {
      process.env.TZ = tz;
      expect(horaLocalParaUtc('2026-09-15', '14:00').toISOString())
        .toBe('2026-09-15T17:00:00.000Z');
      expect(dataLocal(new Date('2026-09-15T17:00:00Z'))).toBe('2026-09-15');
      expect(horaLocal(new Date('2026-09-15T17:00:00Z'))).toBe('14:00');
      expect(diaDaSemana(new Date('2026-09-15T17:00:00Z'))).toBe(2); // terça
    } finally {
      process.env.TZ = original;
    }
  });
});

describe('horário de verão', () => {
  it('mantém a hora de parede numa zona COM DST, atravessando a transição', () => {
    // Nova York: DST termina em 01/11/2026. 09:00 local antes e depois
    // são offsets diferentes — a hora de parede é que deve se manter.
    const antes = horaLocalParaUtc('2026-10-30', '09:00', 'America/New_York');
    const depois = horaLocalParaUtc('2026-11-02', '09:00', 'America/New_York');
    expect(antes.toISOString()).toBe('2026-10-30T13:00:00.000Z'); // EDT, UTC-4
    expect(depois.toISOString()).toBe('2026-11-02T14:00:00.000Z'); // EST, UTC-5
    expect(horaLocal(antes, 'America/New_York')).toBe('09:00');
    expect(horaLocal(depois, 'America/New_York')).toBe('09:00');
  });
});

describe('diasNoIntervalo', () => {
  it('inclui as duas pontas', () => {
    expect(diasNoIntervalo('2026-09-14', '2026-09-16'))
      .toEqual(['2026-09-14', '2026-09-15', '2026-09-16']);
  });
  it('devolve lista vazia quando o fim é anterior ao início', () => {
    expect(diasNoIntervalo('2026-09-16', '2026-09-14')).toEqual([]);
  });
  it('atravessa virada de mês e ano bissexto', () => {
    expect(diasNoIntervalo('2028-02-28', '2028-03-01'))
      .toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
  });
});

describe('formatos do RFC 5545', () => {
  it('emUtcCompacto usa sufixo Z', () => {
    expect(emUtcCompacto(new Date('2026-09-15T17:00:00Z'))).toBe('20260915T170000Z');
  });
  it('emLocalCompacto usa a hora de parede, sem sufixo', () => {
    expect(emLocalCompacto(new Date('2026-09-15T17:00:00Z'))).toBe('20260915T140000');
  });
});
