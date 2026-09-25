/**
 * lib/datetime-cliente.ts — contraparte de lib/datetime.ts para o navegador:
 * só aritmética de CALENDÁRIO sobre 'YYYY-MM-DD' e formatação via Intl.
 * Nenhuma conta de fuso aqui (regra nº 1).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  somarDias, rotuloDia, dataPorExtenso, horaNoFuso, fusoDoPaciente, nomeDoFuso,
} from '@/lib/datetime-cliente';

describe('somarDias', () => {
  it('soma dentro do mês', () => {
    expect(somarDias('2026-09-10', 5)).toBe('2026-09-15');
  });
  it('atravessa mês e ano', () => {
    expect(somarDias('2026-09-28', 5)).toBe('2026-10-03');
    expect(somarDias('2026-12-30', 5)).toBe('2027-01-04');
  });
  it('atravessa fevereiro bissexto e não bissexto', () => {
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29');   // 2028 é bissexto
    expect(somarDias('2027-02-28', 1)).toBe('2027-03-01');   // 2027 não é
  });
  it('aceita n negativo (voltar no tempo)', () => {
    expect(somarDias('2026-09-10', -10)).toBe('2026-08-31');
  });
  it('n = 0 devolve a mesma data', () => {
    expect(somarDias('2026-09-10', 0)).toBe('2026-09-10');
  });
});

describe('rotuloDia', () => {
  it('monta os rótulos curto e longo do dia e do mês', () => {
    expect(rotuloDia('2026-09-15', 2)).toEqual({
      semana: 'ter', semanaLonga: 'terça-feira', numero: 15, mes: 'set', mesLongo: 'setembro',
    });
  });
  it('diaSemana fora do intervalo 0-6 devolve string vazia (sem lançar)', () => {
    expect(rotuloDia('2026-09-15', 9).semana).toBe('');
    expect(rotuloDia('2026-09-15', 9).semanaLonga).toBe('');
  });
});

describe('dataPorExtenso', () => {
  it('formata "dia-da-semana, dia de mês"', () => {
    expect(dataPorExtenso('2026-09-15', 2)).toBe('terça-feira, 15 de setembro');
  });
});

describe('horaNoFuso', () => {
  it('formata a hora de um instante ISO no fuso pedido', () => {
    // 12:00 UTC = 09:00 em São Paulo (UTC-3, sem DST em set/2026)
    expect(horaNoFuso('2026-09-15T12:00:00.000Z', 'America/Sao_Paulo')).toBe('09:00');
  });
});

describe('fusoDoPaciente', () => {
  afterEach(() => vi.restoreAllMocks());

  /**
   * Fuso "do navegador" fixo; hora local por fuso, para simular offsets.
   * Precisa ser `function` (não arrow): `horaNoFuso` chama com `new`.
   */
  function mockarIntl(fusoNavegador: string, horaPorFuso: Record<string, string>) {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (...args: unknown[]) {
      const opts = args[1] as { timeZone?: string } | undefined;
      if (!opts) return { resolvedOptions: () => ({ timeZone: fusoNavegador }) } as unknown as Intl.DateTimeFormat;
      return { format: () => horaPorFuso[opts.timeZone!] ?? '??:??' } as unknown as Intl.DateTimeFormat;
    } as unknown as typeof Intl.DateTimeFormat);
  }

  it('mesmo fuso da clínica → null (não interessa avisar)', () => {
    mockarIntl('America/Sao_Paulo', {});
    expect(fusoDoPaciente('America/Sao_Paulo')).toBeNull();
  });

  it('fuso diferente mas MESMO horário local (mesmo offset) → null', () => {
    mockarIntl('America/Cuiaba', { 'America/Cuiaba': '10:00', 'America/Sao_Paulo': '10:00' });
    expect(fusoDoPaciente('America/Sao_Paulo')).toBeNull();
  });

  it('fuso diferente com offset diferente → devolve o fuso do paciente', () => {
    mockarIntl('Europe/Lisbon', { 'Europe/Lisbon': '14:00', 'America/Sao_Paulo': '11:00' });
    expect(fusoDoPaciente('America/Sao_Paulo')).toBe('Europe/Lisbon');
  });

  it('Intl lançando (ambiente sem suporte) → null, nunca propaga o erro', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => { throw new Error('sem suporte'); });
    expect(fusoDoPaciente('America/Sao_Paulo')).toBeNull();
  });
});

describe('nomeDoFuso', () => {
  it('extrai a cidade e troca underscore por espaço', () => {
    expect(nomeDoFuso('America/Sao_Paulo')).toBe('Sao Paulo');
    expect(nomeDoFuso('America/Cuiaba')).toBe('Cuiaba');
  });
  it('sem barra, devolve o próprio valor', () => {
    expect(nomeDoFuso('UTC')).toBe('UTC');
  });
});
