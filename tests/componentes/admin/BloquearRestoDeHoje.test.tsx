// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BloquearRestoDeHoje } from '@/components/admin/BloquearRestoDeHoje';

const acaoRestoDeHoje = vi.fn();
vi.mock('@/app/admin/(painel)/acoes', () => ({
  acaoRestoDeHoje: (...args: unknown[]) => acaoRestoDeHoje(...args),
}));

afterEach(() => {
  cleanup();
  acaoRestoDeHoje.mockReset();
});

describe('<BloquearRestoDeHoje>', () => {
  it('botão de envio com o rótulo correto', () => {
    acaoRestoDeHoje.mockResolvedValue(null);
    render(<BloquearRestoDeHoje />);
    expect(screen.getByRole('button', { name: /Bloquear o resto de hoje/ })).toBeTruthy();
  });

  it('ao enviar, chama a action e mostra o resultado de sucesso', async () => {
    acaoRestoDeHoje.mockResolvedValue({ ok: 'Pronto: o resto de hoje está bloqueado.' });
    const user = userEvent.setup();
    render(<BloquearRestoDeHoje />);

    await user.click(screen.getByRole('button', { name: /Bloquear o resto de hoje/ }));

    expect(acaoRestoDeHoje).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toContain('Pronto: o resto de hoje está bloqueado.');
  });

  it('mostra a mensagem de erro devolvida pela action', async () => {
    acaoRestoDeHoje.mockResolvedValue({ erro: 'Não foi possível concluir. Tente de novo.' });
    const user = userEvent.setup();
    render(<BloquearRestoDeHoje />);

    await user.click(screen.getByRole('button', { name: /Bloquear o resto de hoje/ }));

    expect(screen.getByRole('alert').textContent).toContain('Não foi possível concluir. Tente de novo.');
  });

  it('desabilita o botão enquanto a action está em andamento', async () => {
    let resolver: (v: unknown) => void = () => {};
    acaoRestoDeHoje.mockImplementation(() => new Promise((resolve) => { resolver = resolve; }));
    const user = userEvent.setup();
    render(<BloquearRestoDeHoje />);

    const botao = screen.getByRole('button', { name: /Bloquear o resto de hoje/ });
    await user.click(botao);
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);

    await act(async () => {
      resolver(null);
      await Promise.resolve();
    });
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false);
  });
});
