// @vitest-environment jsdom
/**
 * Componentes em jsdom com Testing Library: o que a pessoa vê e aciona
 * (papel, nome acessível), nunca classe CSS.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CampoTexto } from '@/components/agendamento/Campo';

afterEach(cleanup);

describe('<CampoTexto>', () => {
  it('rótulo associado ao campo e "(opcional)" quando não é obrigatório', () => {
    render(<CampoTexto id="motivo" rotulo="Motivo" />);
    expect(screen.getByRole('textbox', { name: /Motivo/ })).toBeTruthy();
    expect(screen.getByText(/\(opcional\)/)).toBeTruthy();
  });

  it('erro: aria-invalid, mensagem com role=alert e ligada por aria-describedby', () => {
    render(<CampoTexto id="nome" rotulo="Nome completo" obrigatorio erro="Informe nome e sobrenome." />);
    const campo = screen.getByRole('textbox', { name: /Nome completo/ });
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('Informe nome e sobrenome.');
    expect(campo.getAttribute('aria-describedby')).toContain('nome-erro');
  });
});
