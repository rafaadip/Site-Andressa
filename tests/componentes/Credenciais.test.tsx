// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Credenciais } from '@/components/site/Credenciais';
import { PROFISSIONAL } from '@/lib/config';
import { CREDENCIAIS } from '@/lib/content/site';

afterEach(cleanup);

describe('<Credenciais>', () => {
  it('o CRM vem de lib/config.ts (nunca escrito à mão) e aparece antes das demais credenciais', () => {
    render(<Credenciais />);
    const itens = screen.getAllByRole('listitem');
    expect(itens).toHaveLength(CREDENCIAIS.length + 1);
    expect(itens[0]!.textContent).toContain(PROFISSIONAL.crm);
    expect(itens[0]!.textContent).toContain('Conselho Regional de Medicina');
  });

  it('lista as demais credenciais de site.ts', () => {
    render(<Credenciais />);
    for (const c of CREDENCIAIS) {
      expect(screen.getByText(c.titulo)).toBeTruthy();
      expect(screen.getByText(c.detalhe)).toBeTruthy();
    }
  });
});
