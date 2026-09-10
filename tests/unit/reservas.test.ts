import { describe, it, expect } from 'vitest';
import { chaveDoSlot, reservarSlot, SlotIndisponivelError } from '@/lib/db/reservas';

describe('chaveDoSlot', () => {
  const P = '11111111-1111-1111-1111-111111111111';

  it('é determinística', () => {
    const d = new Date('2026-09-15T17:00:00Z');
    expect(chaveDoSlot(P, d)).toBe(chaveDoSlot(P, d));
  });

  it('distingue horários diferentes', () => {
    expect(chaveDoSlot(P, new Date('2026-09-15T17:00:00Z')))
      .not.toBe(chaveDoSlot(P, new Date('2026-09-15T17:50:00Z')));
  });

  it('distingue profissionais diferentes', () => {
    const d = new Date('2026-09-15T17:00:00Z');
    expect(chaveDoSlot(P, d))
      .not.toBe(chaveDoSlot('22222222-2222-2222-2222-222222222222', d));
  });

  it('cabe em bigint com sinal do Postgres', () => {
    for (let i = 0; i < 200; i++) {
      const k = chaveDoSlot(P, new Date(Date.now() + i * 3_600_000));
      expect(k).toBeGreaterThanOrEqual(-(2n ** 63n));
      expect(k).toBeLessThanOrEqual(2n ** 63n - 1n);
    }
  });
});

describe('reservarSlot', () => {
  it('traduz 23P01 em SlotIndisponivelError sem retentar', async () => {
    let chamadas = 0;
    await expect(reservarSlot(async () => {
      chamadas++;
      throw Object.assign(new Error('conflito'), { code: '23P01' });
    })).rejects.toBeInstanceOf(SlotIndisponivelError);
    expect(chamadas).toBe(1);
  });

  it('retenta em 40P01 e devolve o sucesso da 2ª tentativa', async () => {
    let chamadas = 0;
    const r = await reservarSlot(async () => {
      chamadas++;
      if (chamadas === 1) throw Object.assign(new Error('deadlock'), { code: '40P01' });
      return 'inserido';
    });
    expect(r).toBe('inserido');
    expect(chamadas).toBe(2);
  });

  it('após esgotar as tentativas de deadlock, vira conflito de domínio', async () => {
    let chamadas = 0;
    await expect(reservarSlot(async () => {
      chamadas++;
      throw Object.assign(new Error('deadlock'), { code: '40P01' });
    }, 3)).rejects.toBeInstanceOf(SlotIndisponivelError);
    expect(chamadas).toBe(3);
  });

  it('propaga erro que não é de concorrência', async () => {
    await expect(reservarSlot(async () => {
      throw Object.assign(new Error('coluna inexistente'), { code: '42703' });
    })).rejects.toThrow('coluna inexistente');
  });
});
