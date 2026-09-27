// @vitest-environment jsdom
/**
 * Seções estáticas do site: o texto vem de lib/content/site.ts e o título
 * profissional de lib/config.ts (regras 5 e 10 do CLAUDE.md) — nunca à mão.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { PROFISSIONAL, tituloPublico } from '@/lib/config';
import { NUTROLOGIA, SOBRE } from '@/lib/content/site';
import { Sobre } from '@/components/site/Sobre';
import { Nutrologia } from '@/components/site/Nutrologia';
import { Rodape } from '@/components/site/Rodape';

afterEach(cleanup);

describe('<Sobre>', () => {
  it('nome e parágrafos vêm do conteúdo central; sem trajetória na home', () => {
    render(<Sobre />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(PROFISSIONAL.nome);
    expect(screen.getByText(SOBRE.paragrafos[0]!)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Trajetória' })).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('um único link, "Mais sobre a doutora", leva à página /sobre', () => {
    render(<Sobre />);
    const link = screen.getByRole('link');
    expect(link.textContent).toContain(SOBRE.linkMais);
    expect(link.getAttribute('href')).toBe('/sobre');
  });
});

describe('<Nutrologia>', () => {
  it('título, lead e um cartão por eixo', () => {
    render(<Nutrologia />);
    expect(screen.getByText(NUTROLOGIA.titulo)).toBeTruthy();
    expect(screen.getByText(NUTROLOGIA.lead)).toBeTruthy();
    // Numerados na ordem ("1. História clínica" …).
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(titulos).toEqual(NUTROLOGIA.eixos.map((e, i) => `${i + 1}. ${e.titulo}`));
  });

  it('não alega especialidade (sem RQE)', () => {
    const { container } = render(<Nutrologia />);
    expect(container.textContent).not.toMatch(/especialista/i);
  });
});

describe('<Rodape>', () => {
  it('título profissional de lib/config e aviso de urgência com o 192', () => {
    const { container } = render(<Rodape />);
    expect(container.textContent).toContain(tituloPublico());
    expect(container.textContent).toContain('192');
  });

  it('navegação institucional com privacidade e termos', () => {
    render(<Rodape />);
    const nav = screen.getByRole('navigation', { name: 'Institucional' });
    expect(within(nav).getByRole('link', { name: 'Política de privacidade' }).getAttribute('href')).toBe('/politica-de-privacidade');
    expect(within(nav).getByRole('link', { name: 'Termos de uso' }).getAttribute('href')).toBe('/termos-de-uso');
  });
});
