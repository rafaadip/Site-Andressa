// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Contato } from '@/components/site/Contato';
import { PROFISSIONAL, localConsulta } from '@/lib/config';
import { linkWhatsApp } from '@/lib/contato';
import { URGENCIA } from '@/lib/content/site';

afterEach(cleanup);

describe('<Contato>', () => {
  it('WhatsApp e e-mail são links clicáveis com os dados de lib/config', () => {
    render(<Contato />);
    const whats = screen.getByRole('link', { name: PROFISSIONAL.telefoneExibicao });
    expect(whats.getAttribute('href')).toBe(linkWhatsApp());
    expect(whats.getAttribute('target')).toBe('_blank');

    const email = screen.getByRole('link', { name: PROFISSIONAL.email });
    expect(email.getAttribute('href')).toBe(`mailto:${PROFISSIONAL.email}`);
  });

  it('consultório sem endereço público: mostra o texto degradado como parágrafo, não como link', () => {
    render(<Contato />);
    expect(PROFISSIONAL.endereco).toBeNull(); // pré-condição documentada em lib/config.ts
    const texto = localConsulta('in_person');
    expect(screen.getByText(texto).tagName).toBe('P');
    expect(screen.queryByRole('link', { name: texto })).toBeNull();
  });

  it('bloco de urgência tem ícone + texto (nunca só cor) com o telefone do SAMU em destaque', () => {
    render(<Contato />);
    expect(screen.getByRole('heading', { name: URGENCIA.titulo })).toBeTruthy();
    expect(screen.getByText(new RegExp(URGENCIA.texto))).toBeTruthy();
    const destaque = screen.getByText(URGENCIA.telefone);
    expect(destaque.tagName).toBe('STRONG');
  });
});
