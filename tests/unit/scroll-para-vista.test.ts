/**
 * @vitest-environment jsdom
 *
 * lib/scroll-para-vista.ts — rolarParaVista(): respeita
 * `prefers-reduced-motion` e não lança sem elemento.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { rolarParaVista } from '@/lib/scroll-para-vista';

function mockarReducedMotion(reduzir: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('reduce') && reduzir,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
}

describe('rolarParaVista', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('elemento nulo/undefined: não lança e não chama scrollIntoView', () => {
    expect(() => rolarParaVista(null)).not.toThrow();
    expect(() => rolarParaVista(undefined)).not.toThrow();
  });

  it('sem reduced motion: rola suave (behavior: smooth)', () => {
    mockarReducedMotion(false);
    const el = document.createElement('div');
    const scrollIntoView = vi.fn();
    el.scrollIntoView = scrollIntoView;
    rolarParaVista(el);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
  });

  it('com prefers-reduced-motion: reduce, usa behavior: auto (sem animação)', () => {
    mockarReducedMotion(true);
    const el = document.createElement('div');
    const scrollIntoView = vi.fn();
    el.scrollIntoView = scrollIntoView;
    rolarParaVista(el);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' });
  });

  it('opções customizadas são preservadas (menos `behavior`, sempre calculado)', () => {
    mockarReducedMotion(false);
    const el = document.createElement('div');
    const scrollIntoView = vi.fn();
    el.scrollIntoView = scrollIntoView;
    rolarParaVista(el, { block: 'end', inline: 'nearest' });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'end', inline: 'nearest', behavior: 'smooth' });
  });
});
