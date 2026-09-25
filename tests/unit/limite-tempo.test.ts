import { describe, it, expect, vi, afterEach } from 'vitest';
import { comLimiteDeTempo, ESGOTOU } from '@/lib/limite-tempo';

describe('comLimiteDeTempo', () => {
  afterEach(() => vi.useRealTimers());

  it('devolve o valor quando a promessa chega antes do limite', async () => {
    expect(await comLimiteDeTempo(Promise.resolve(42), 1000)).toBe(42);
  });

  it('devolve ESGOTOU quando a dependência pendura (banco sem resposta)', async () => {
    vi.useFakeTimers();
    const pendurada = new Promise<number>(() => { /* nunca resolve */ });
    const r = comLimiteDeTempo(pendurada, 800);
    await vi.advanceTimersByTimeAsync(800);
    expect(await r).toBe(ESGOTOU);
  });

  it('propaga a rejeição (quem chama decide o plano B)', async () => {
    await expect(comLimiteDeTempo(Promise.reject(new Error('banco caiu')), 1000)).rejects.toThrow('banco caiu');
  });

  it('não deixa timer pendurado depois de resolver', async () => {
    vi.useFakeTimers();
    await comLimiteDeTempo(Promise.resolve('ok'), 5000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
