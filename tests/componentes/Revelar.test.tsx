// @vitest-environment jsdom
/**
 * Revelação ao rolar: aprimoramento progressivo. Nada nasce escondido no
 * HTML; só o que está ABAIXO da dobra é escondido depois do JS, e aparece
 * quando entra na tela. Movimento reduzido desliga tudo.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { act } from 'react';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
const { Revelar } = await import('@/components/site/Revelar');

type Entrada = { target: Element; isIntersecting: boolean };

class ObservadorFalso {
  static instancia: ObservadorFalso | null = null;
  alvos: Element[] = [];
  constructor(public callback: (e: Entrada[]) => void) { ObservadorFalso.instancia = this; }
  observe(el: Element) { this.alvos.push(el); }
  unobserve(el: Element) { this.alvos = this.alvos.filter((a) => a !== el); }
  disconnect() { this.alvos = []; }
}

/** Monta dois alvos: um acima da dobra (top 100) e um abaixo (top 2000). */
function montarAlvos() {
  document.body.innerHTML = '<div id="acima" data-revelar></div><div id="abaixo" data-revelar></div>';
  const acima = document.getElementById('acima')!;
  const abaixo = document.getElementById('abaixo')!;
  acima.getBoundingClientRect = () => ({ top: 100 } as DOMRect);
  abaixo.getBoundingClientRect = () => ({ top: 2000 } as DOMRect);
  return { acima, abaixo };
}

function movimento(reduzido: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: reduzido }));
}

beforeEach(() => {
  ObservadorFalso.instancia = null;
  vi.stubGlobal('IntersectionObserver', ObservadorFalso);
  vi.stubGlobal('innerHeight', 800);
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('<Revelar>', () => {
  it('esconde só o que está abaixo da dobra; o que já está na tela não pisca', () => {
    movimento(false);
    const { acima, abaixo } = montarAlvos();
    render(<Revelar />);
    expect(acima.hasAttribute('data-revelado')).toBe(false);
    expect(abaixo.getAttribute('data-revelado')).toBe('nao');
    expect(ObservadorFalso.instancia?.alvos).toEqual([abaixo]);
  });

  it('ao entrar na tela, revela e depois limpa o estado', () => {
    movimento(false);
    const { abaixo } = montarAlvos();
    render(<Revelar />);
    act(() => ObservadorFalso.instancia!.callback([{ target: abaixo, isIntersecting: true }]));
    expect(abaixo.getAttribute('data-revelado')).toBe('sim');
    act(() => { vi.advanceTimersByTime(3000); });
    expect(abaixo.hasAttribute('data-revelado')).toBe(false);
  });

  it('com movimento reduzido, não esconde nada', () => {
    movimento(true);
    const { abaixo } = montarAlvos();
    render(<Revelar />);
    expect(abaixo.hasAttribute('data-revelado')).toBe(false);
    expect(ObservadorFalso.instancia).toBeNull();
  });

  it('ao desmontar, nada fica escondido para trás', () => {
    movimento(false);
    const { abaixo } = montarAlvos();
    const { unmount } = render(<Revelar />);
    expect(abaixo.getAttribute('data-revelado')).toBe('nao');
    unmount();
    expect(abaixo.hasAttribute('data-revelado')).toBe(false);
  });
});
