// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Atendimento } from '@/components/site/Atendimento';
import { ATENDIMENTO } from '@/lib/content/site';
import { localConsulta } from '@/lib/config';

afterEach(cleanup);

describe('<Atendimento>', () => {
  it('lista as modalidades de site.ts, com título e texto', () => {
    render(<Atendimento />);
    for (const m of ATENDIMENTO.modalidades) {
      expect(screen.getByRole('heading', { name: m.titulo })).toBeTruthy();
      expect(screen.getByText(m.texto)).toBeTruthy();
      expect(screen.getByText(m.etiqueta)).toBeTruthy();
    }
  });

  it('só a modalidade presencial mostra o local do consultório (aparece uma única vez)', () => {
    render(<Atendimento />);
    expect(screen.getAllByText(localConsulta('in_person'))).toHaveLength(1);
  });
});
