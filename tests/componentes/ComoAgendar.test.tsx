// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ComoAgendar } from '@/components/site/ComoAgendar';
import { COMO_AGENDAR } from '@/lib/content/site';
import { linkWhatsApp, MENSAGEM_AGENDAMENTO } from '@/lib/contato';

afterEach(cleanup);

describe('<ComoAgendar>', () => {
  it('lista os passos de site.ts, na ordem', () => {
    render(<ComoAgendar />);
    const itens = screen.getAllByRole('listitem');
    expect(itens).toHaveLength(COMO_AGENDAR.passos.length);
    COMO_AGENDAR.passos.forEach((p, i) => {
      expect(itens[i]!.textContent).toContain(p.titulo);
      expect(itens[i]!.textContent).toContain(p.texto);
    });
  });

  it('CTA "Agendar consulta" aponta para /agendar; link secundário vai pro WhatsApp', () => {
    render(<ComoAgendar />);
    expect(screen.getByRole('link', { name: /Agendar consulta/ }).getAttribute('href')).toBe('/agendar');
    const whats = screen.getByRole('link', { name: /Fale pelo WhatsApp/ });
    expect(whats.getAttribute('href')).toBe(linkWhatsApp(MENSAGEM_AGENDAMENTO));
  });
});
