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

describe('<Atendimento> — cada cartão marca a consulta', () => {
  it('um link por modalidade, com o nome dela, levando ao /agendar com a modalidade', () => {
    render(<Atendimento />);
    const esperado: Record<string, string> = {
      'Consulta em Nutrologia': '/agendar?modalidade=in_person',
      Teleconsulta: '/agendar?modalidade=telehealth',
      Acompanhamento: '/agendar',
    };
    for (const m of ATENDIMENTO.modalidades) {
      const link = screen.getByRole('link', { name: m.titulo });
      expect(link.getAttribute('href')).toBe(esperado[m.titulo]);
      expect(link.getAttribute('aria-describedby')).toBeTruthy();
      expect(document.getElementById(link.getAttribute('aria-describedby')!)!.textContent).toBe(ATENDIMENTO.cta);
    }
    expect(screen.getAllByRole('link')).toHaveLength(ATENDIMENTO.modalidades.length);
  });
});
