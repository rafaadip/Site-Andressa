// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Faq } from '@/components/site/Faq';
import { perguntasFrequentes } from '@/lib/content/site';

afterEach(cleanup);

describe('<Faq>', () => {
  it('lista todas as perguntas de site.ts, cada uma num <details> fechável', () => {
    render(<Faq prazoCancelamentoHoras={24} />);
    const perguntas = perguntasFrequentes(24);
    for (const p of perguntas) {
      expect(screen.getByText(p.pergunta)).toBeTruthy();
    }
    expect(document.querySelectorAll('details')).toHaveLength(perguntas.length);
  });

  it('o prazo de cancelamento vem por prop, não escrito à mão', () => {
    render(<Faq prazoCancelamentoHoras={48} />);
    expect(screen.getByText(/até 48 horas antes/)).toBeTruthy();
    expect(screen.queryByText(/até 24 horas antes/)).toBeNull();
  });
});
