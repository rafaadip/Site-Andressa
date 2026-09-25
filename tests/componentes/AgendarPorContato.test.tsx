// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AgendarPorContato } from '@/components/agendamento/AgendarPorContato';
import { PROFISSIONAL, localConsulta } from '@/lib/config';
import { linkWhatsApp, MENSAGEM_AGENDAMENTO } from '@/lib/contato';

afterEach(cleanup);

describe('<AgendarPorContato>', () => {
  it('oferece WhatsApp e e-mail como caminhos de agendamento', () => {
    render(<AgendarPorContato />);
    const whats = screen.getByRole('link', { name: /Agendar pelo WhatsApp/ });
    expect(whats.getAttribute('href')).toBe(linkWhatsApp(MENSAGEM_AGENDAMENTO));

    const email = screen.getByRole('link', { name: /Enviar e-mail/ });
    expect(email.getAttribute('href')).toBe(
      `mailto:${PROFISSIONAL.email}?subject=${encodeURIComponent('Agendamento de consulta')}`,
    );
  });

  it('mostra o local presencial e a teleconsulta a partir de localConsulta()', () => {
    render(<AgendarPorContato />);
    expect(screen.getByText(localConsulta('in_person'))).toBeTruthy();
    expect(screen.getByText(localConsulta('telehealth'))).toBeTruthy();
  });
});
