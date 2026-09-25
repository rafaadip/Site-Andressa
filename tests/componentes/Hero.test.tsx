// @vitest-environment jsdom
/**
 * Hero importa um PNG estático (via loader do Next, que não existe no
 * Vitest) e `next/image` (que precisa de `src` string em jsdom) — os dois
 * são mockados aqui.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PROFISSIONAL } from '@/lib/config';
import { HERO } from '@/lib/content/site';

vi.mock('@/public/retratos/andressa-circular.png', () => ({
  default: { src: '/retratos/andressa-circular.png', width: 400, height: 400, blurDataURL: 'data:image/png;base64,' },
}));
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={props.alt as string} src={(props.src as { src: string })?.src ?? (props.src as string)} />;
  },
}));

const { Hero } = await import('@/components/site/Hero');

afterEach(cleanup);

describe('<Hero>', () => {
  it('mostra o título, o lead e a cidade/UF de lib/config', () => {
    render(<Hero />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(HERO.titulo);
    expect(screen.getByText(new RegExp(`${PROFISSIONAL.cidade}.*${PROFISSIONAL.uf}`))).toBeTruthy();
    expect(screen.getByText(HERO.lead)).toBeTruthy();
  });

  it('CTA primário vai para /agendar e o secundário para #sobre', () => {
    render(<Hero />);
    expect(screen.getByRole('link', { name: new RegExp(HERO.ctaPrimario) }).getAttribute('href')).toBe('/agendar');
    expect(screen.getByRole('link', { name: HERO.ctaSecundario }).getAttribute('href')).toBe('/#sobre');
  });

  it('o retrato tem texto alternativo com o nome completo da médica', () => {
    render(<Hero />);
    expect(screen.getByRole('img').getAttribute('alt')).toContain(PROFISSIONAL.nome);
  });
});
