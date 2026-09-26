// @vitest-environment jsdom
/**
 * Holofote: só com mouse (hover + ponteiro fino) e sem movimento reduzido,
 * grava a posição do ponteiro em --mx/--my do cartão `data-holofote`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Holofote } from '@/components/site/Holofote';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

/** matchMedia: ponteiro fino e movimento reduzido configuráveis. */
function midia({ fino, reduzido }: { fino: boolean; reduzido: boolean }) {
  vi.stubGlobal('matchMedia', vi.fn((q: string) => ({
    matches: q.includes('reduced-motion') ? reduzido : fino,
  })));
}

function cartao() {
  document.body.innerHTML = '<ul><li data-holofote id="c"><span id="dentro">x</span></li></ul>';
  const c = document.getElementById('c')!;
  c.getBoundingClientRect = () => ({ left: 100, top: 50 } as DOMRect);
  return c;
}

function moverPara(el: Element, x: number, y: number) {
  const e = new MouseEvent('pointermove', { bubbles: true, clientX: x, clientY: y });
  el.dispatchEvent(e);
}

describe('<Holofote>', () => {
  it('com mouse: grava a posição relativa ao cartão', () => {
    midia({ fino: true, reduzido: false });
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { fn(0); return 1; });
    const c = cartao();
    render(<Holofote />);
    moverPara(document.getElementById('dentro')!, 160, 90);
    expect(c.style.getPropertyValue('--mx')).toBe('60px');
    expect(c.style.getPropertyValue('--my')).toBe('40px');
  });

  it('no toque (sem ponteiro fino) não faz nada', () => {
    midia({ fino: false, reduzido: false });
    const c = cartao();
    render(<Holofote />);
    moverPara(document.getElementById('dentro')!, 160, 90);
    expect(c.style.getPropertyValue('--mx')).toBe('');
  });

  it('com movimento reduzido não faz nada', () => {
    midia({ fino: true, reduzido: true });
    const c = cartao();
    render(<Holofote />);
    moverPara(document.getElementById('dentro')!, 160, 90);
    expect(c.style.getPropertyValue('--mx')).toBe('');
  });
});
