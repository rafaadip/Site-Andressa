// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { act } from 'react';
import { BarraAgendarMobile } from '@/components/site/BarraAgendarMobile';

afterEach(cleanup);

type Callback = (entradas: Array<{ target: Element; isIntersecting: boolean }>) => void;

/** jsdom não implementa IntersectionObserver: um fake que guarda o callback
 * e os elementos observados, para disparar entradas manualmente no teste. */
class ObservadorFalso {
  static instancia: ObservadorFalso | null = null;
  alvos: Element[] = [];
  constructor(public callback: Callback) {
    ObservadorFalso.instancia = this;
  }
  observe(el: Element) { this.alvos.push(el); }
  disconnect() { /* nada a limpar no fake */ }
  unobserve() { /* nada a limpar no fake */ }
}

function dispararIntersecao(alvo: Element, isIntersecting: boolean) {
  act(() => {
    ObservadorFalso.instancia?.callback([{ target: alvo, isIntersecting }]);
  });
}

beforeEach(() => {
  ObservadorFalso.instancia = null;
  vi.stubGlobal('IntersectionObserver', ObservadorFalso);
});

describe('<BarraAgendarMobile>', () => {
  it('sem #inicio no documento: fica escondida (aria-hidden e inert), sem observar nada', () => {
    render(<BarraAgendarMobile />);
    const barra = screen.getByTestId('barra-agendar');
    expect(barra.getAttribute('aria-hidden')).toBe('true');
    expect(barra.hasAttribute('inert')).toBe(true);
    expect(ObservadorFalso.instancia).toBeNull();
  });

  it('hero visível (recém-montado): permanece escondida', () => {
    document.body.innerHTML = '<div id="inicio"></div>';
    render(<BarraAgendarMobile />);
    const hero = document.getElementById('inicio')!;
    dispararIntersecao(hero, true);
    expect(screen.getByTestId('barra-agendar').getAttribute('aria-hidden')).toBe('true');
  });

  it('hero saiu da tela e a seção de agendar não está visível: barra aparece', () => {
    document.body.innerHTML = '<div id="inicio"></div><div id="agendar"></div>';
    render(<BarraAgendarMobile />);
    const hero = document.getElementById('inicio')!;
    const agendar = document.getElementById('agendar')!;
    dispararIntersecao(hero, false);
    dispararIntersecao(agendar, false);
    const barra = screen.getByTestId('barra-agendar');
    expect(barra.getAttribute('aria-hidden')).toBe('false');
    expect(barra.hasAttribute('inert')).toBe(false);
  });

  it('some de novo quando a seção de agendar entra na tela (evita CTA duplicado)', () => {
    document.body.innerHTML = '<div id="inicio"></div><div id="agendar"></div>';
    render(<BarraAgendarMobile />);
    const hero = document.getElementById('inicio')!;
    const agendar = document.getElementById('agendar')!;
    dispararIntersecao(hero, false);
    dispararIntersecao(agendar, false);
    expect(screen.getByTestId('barra-agendar').getAttribute('aria-hidden')).toBe('false');

    dispararIntersecao(agendar, true);
    expect(screen.getByTestId('barra-agendar').getAttribute('aria-hidden')).toBe('true');
  });

  it('o link interno leva para /agendar (consultado mesmo escondida, via hidden: true)', () => {
    document.body.innerHTML = '<div id="inicio"></div>';
    render(<BarraAgendarMobile />);
    expect(screen.getByRole('link', { name: /Agendar consulta/, hidden: true }).getAttribute('href')).toBe('/agendar');
  });
});
