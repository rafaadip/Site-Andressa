// @vitest-environment jsdom
import { act } from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Cabecalho } from '@/components/site/Cabecalho';
import { PROFISSIONAL } from '@/lib/config';
import { NAVEGACAO } from '@/lib/content/site';

afterEach(cleanup);

/** `window.matchMedia` não existe no jsdom; um fake que também guarda os
 * listeners registrados, para simular "a tela cresceu para desktop". */
class MediaQueryFalsa {
  matches = false;
  listeners: Array<(e: { matches: boolean }) => void> = [];
  addEventListener(_: string, fn: (e: { matches: boolean }) => void) { this.listeners.push(fn); }
  removeEventListener(_: string, fn: (e: { matches: boolean }) => void) {
    this.listeners = this.listeners.filter((l) => l !== fn);
  }
  disparar(matches: boolean) {
    this.matches = matches;
    this.listeners.forEach((l) => l({ matches }));
  }
}

let mq: MediaQueryFalsa;

beforeEach(() => {
  mq = new MediaQueryFalsa();
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mq));
});

describe('<Cabecalho>', () => {
  it('logo leva para "/" com o nome curto da médica', () => {
    render(<Cabecalho />);
    const logo = screen.getByRole('link', { name: `${PROFISSIONAL.nomeCurto} — página inicial` });
    expect(logo.getAttribute('href')).toBe('/');
  });

  it('nav de desktop lista os itens de site.ts e o CTA "Agendar consulta"', () => {
    render(<Cabecalho />);
    for (const item of NAVEGACAO) {
      expect(screen.getByRole('link', { name: item.rotulo })).toBeTruthy();
    }
    expect(screen.getAllByRole('link', { name: /Agendar consulta/ }).length).toBeGreaterThan(0);
  });

  it('menu fechado por padrão: aria-expanded=false, painel oculto', () => {
    render(<Cabecalho />);
    const botao = screen.getByRole('button', { name: 'Abrir menu' });
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    const idPainel = botao.getAttribute('aria-controls')!;
    expect(document.getElementById(idPainel)?.hasAttribute('hidden')).toBe(true);
  });

  it('abrir o menu: aria-expanded=true, painel visível, foco no 1º link do painel', async () => {
    const user = userEvent.setup();
    render(<Cabecalho />);
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }));

    const botao = screen.getByRole('button', { name: 'Fechar menu' });
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    const idPainel = botao.getAttribute('aria-controls')!;
    const painel = document.getElementById(idPainel)!;
    expect(painel.hasAttribute('hidden')).toBe(false);
    expect(document.activeElement).toBe(painel.querySelector('a'));
  });

  it('Esc fecha o menu e devolve o foco ao botão', async () => {
    const user = userEvent.setup();
    render(<Cabecalho />);
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
    await user.keyboard('{Escape}');

    const botao = screen.getByRole('button', { name: 'Abrir menu' });
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(botao);
  });

  it('clicar num link do painel mobile fecha o menu (sem devolver foco ao botão)', async () => {
    const user = userEvent.setup();
    render(<Cabecalho />);
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }));

    const idPainel = screen.getByRole('button', { name: 'Fechar menu' }).getAttribute('aria-controls')!;
    const painel = document.getElementById(idPainel)!;
    const primeiroLink = painel.querySelector('a')!;
    await user.click(primeiroLink);

    expect(screen.getByRole('button', { name: 'Abrir menu' })).toBeTruthy();
    expect(painel.hasAttribute('hidden')).toBe(true);
  });

  it('clicar de novo no botão fecha o menu', async () => {
    const user = userEvent.setup();
    render(<Cabecalho />);
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
    await user.click(screen.getByRole('button', { name: 'Fechar menu' }));
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toBeTruthy();
  });

  it('a tela crescendo para desktop com o menu aberto fecha o menu sozinho', async () => {
    const user = userEvent.setup();
    render(<Cabecalho />);
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
    expect(screen.getByRole('button', { name: 'Fechar menu' })).toBeTruthy();

    act(() => mq.disparar(true)); // matchMedia('(min-width: 1024px)') passou a bater
    expect(screen.getByRole('button', { name: 'Abrir menu' })).toBeTruthy();
  });
});

describe('<Cabecalho> — vidro que acompanha o fundo (Liquid Glass)', () => {
  /** Seção escura numa faixa da tela. O jsdom não faz layout: o retângulo é
   * dado à mão (o do cabeçalho fica em 0 — o "meio da pílula" é y = 0). */
  function secaoEscura(topo: number, base: number) {
    const el = document.createElement('section');
    el.className = 'superficie-escura';
    posicionar(el, topo, base);
    document.body.appendChild(el);
    return el;
  }
  function posicionar(el: HTMLElement, topo: number, base: number) {
    el.getBoundingClientRect = () =>
      ({ top: topo, bottom: base, left: 0, right: 0, width: 0, height: base - topo, x: 0, y: topo, toJSON: () => ({}) });
  }
  const proximoQuadro = () => act(async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  });
  const tom = () => screen.getByRole('banner').getAttribute('data-tom');

  afterEach(() => document.querySelectorAll('.superficie-escura').forEach((el) => el.remove()));

  it('sobre página clara, o vidro é claro', async () => {
    render(<Cabecalho />);
    await proximoQuadro();
    expect(tom()).toBe('claro');
  });

  it('com uma seção escura sob o cabeçalho, o vidro fica escuro', async () => {
    secaoEscura(-100, 600);
    render(<Cabecalho />);
    await proximoQuadro();
    expect(tom()).toBe('escuro');
  });

  it('seção escura mais abaixo não muda o tom — até a rolagem levá-la para baixo do cabeçalho', async () => {
    const secao = secaoEscura(800, 1400);
    render(<Cabecalho />);
    await proximoQuadro();
    expect(tom()).toBe('claro');

    posicionar(secao, -10, 590);
    act(() => { window.dispatchEvent(new Event('scroll')); });
    await proximoQuadro();
    expect(tom()).toBe('escuro');
  });

  it('menu aberto força o tom claro: o painel claro cobre a página', async () => {
    const user = userEvent.setup();
    secaoEscura(-100, 600);
    render(<Cabecalho />);
    await proximoQuadro();
    await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
    expect(tom()).toBe('claro');
  });
});
