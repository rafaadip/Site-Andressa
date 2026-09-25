// @vitest-environment jsdom
/**
 * jsdom não faz layout: `scrollHeight`/`scrollY`/`innerHeight` valem 0 (ou o
 * padrão do ambiente) e não existe `ResizeObserver`. Para testar a "pista de
 * rolagem" do rodapé (um <span aria-hidden> puramente visual, sem
 * contrapartida acessível — por isso, excepcionalmente, localizado por
 * classe em vez de papel/nome), simulamos essas medidas e um stub de
 * `ResizeObserver`.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { NavAdminTopo, NavAdminRodape } from '@/components/admin/NavAdmin';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));

class ResizeObserverFalso {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverFalso);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(usePathname).mockReset();
});

const ITENS_TOPO = ['Agenda', 'Horários', 'Integrações', 'Ajustes', 'Privacidade'];

describe('<NavAdminTopo>', () => {
  it('lista os itens do painel, na navegação "Painel"', () => {
    vi.mocked(usePathname).mockReturnValue('/admin');
    render(<NavAdminTopo />);
    const nav = screen.getByRole('navigation', { name: 'Painel' });
    for (const rotulo of ITENS_TOPO) {
      expect(screen.getByRole('link', { name: rotulo })).toBeTruthy();
    }
    expect(nav.querySelectorAll('a')).toHaveLength(ITENS_TOPO.length);
  });

  it('em /admin, só "Agenda" tem aria-current=page', () => {
    vi.mocked(usePathname).mockReturnValue('/admin');
    render(<NavAdminTopo />);
    expect(screen.getByRole('link', { name: 'Agenda' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Horários' }).getAttribute('aria-current')).toBeNull();
  });

  it('em /admin/consulta/123, "Agenda" continua ativo (a tela de detalhe é parte da agenda)', () => {
    vi.mocked(usePathname).mockReturnValue('/admin/consulta/123');
    render(<NavAdminTopo />);
    expect(screen.getByRole('link', { name: 'Agenda' }).getAttribute('aria-current')).toBe('page');
  });

  it('em /admin/disponibilidade, só "Horários" tem aria-current=page', () => {
    vi.mocked(usePathname).mockReturnValue('/admin/disponibilidade');
    render(<NavAdminTopo />);
    expect(screen.getByRole('link', { name: 'Horários' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Agenda' }).getAttribute('aria-current')).toBeNull();
  });

  it('em /admin/privacidade, só "Privacidade" tem aria-current=page', () => {
    vi.mocked(usePathname).mockReturnValue('/admin/privacidade');
    render(<NavAdminTopo />);
    expect(screen.getByRole('link', { name: 'Privacidade' }).getAttribute('aria-current')).toBe('page');
  });

  it('cada item aponta para o href correspondente', () => {
    vi.mocked(usePathname).mockReturnValue('/admin');
    render(<NavAdminTopo />);
    expect(screen.getByRole('link', { name: 'Agenda' }).getAttribute('href')).toBe('/admin');
    expect(screen.getByRole('link', { name: 'Horários' }).getAttribute('href')).toBe('/admin/disponibilidade');
    expect(screen.getByRole('link', { name: 'Integrações' }).getAttribute('href')).toBe('/admin/integracoes');
    expect(screen.getByRole('link', { name: 'Ajustes' }).getAttribute('href')).toBe('/admin/configuracoes');
    expect(screen.getByRole('link', { name: 'Privacidade' }).getAttribute('href')).toBe('/admin/privacidade');
  });
});

describe('<NavAdminRodape>', () => {
  it('navegação "Painel (celular)" com os mesmos itens', () => {
    vi.mocked(usePathname).mockReturnValue('/admin');
    render(<NavAdminRodape />);
    expect(screen.getByRole('navigation', { name: 'Painel (celular)' })).toBeTruthy();
    for (const rotulo of ITENS_TOPO) {
      expect(screen.getByRole('link', { name: new RegExp(rotulo) })).toBeTruthy();
    }
  });

  it('marca o item ativo com aria-current=page, igual à navegação de topo', () => {
    vi.mocked(usePathname).mockReturnValue('/admin/configuracoes');
    render(<NavAdminRodape />);
    expect(screen.getByRole('link', { name: /Ajustes/ }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: /Agenda/ }).getAttribute('aria-current')).toBeNull();
  });

  it('sem conteúdo abaixo da barra, a pista de rolagem fica com opacidade zero', () => {
    vi.mocked(usePathname).mockReturnValue('/admin');
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    const { container } = render(<NavAdminRodape />);
    const pista = container.querySelector('span[aria-hidden]')!;
    expect(pista.className).toContain('opacity-0');
    expect(pista.className).not.toContain('opacity-100');
  });

  it('com conteúdo abaixo da barra (ex.: um alerta empurrou a tela), a pista aparece ao redimensionar', () => {
    vi.mocked(usePathname).mockReturnValue('/admin');
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    const { container } = render(<NavAdminRodape />);
    const pista = container.querySelector('span[aria-hidden]')!;
    expect(pista.className).toContain('opacity-0');

    // O conteúdo cresceu (formulário expandiu) e agora sobra mais de 4px de rolagem.
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1200, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(pista.className).toContain('opacity-100');
  });
});
