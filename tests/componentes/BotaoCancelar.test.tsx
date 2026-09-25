// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BotaoCancelar } from '@/app/(site)/consulta/[token]/BotaoCancelar';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

const cancelarConsulta = vi.fn();
vi.mock('@/app/(site)/consulta/[token]/acoes', () => ({
  cancelarConsulta: (...args: unknown[]) => cancelarConsulta(...args),
}));

afterEach(() => {
  cleanup();
  refresh.mockClear();
  cancelarConsulta.mockReset();
});

describe('<BotaoCancelar>', () => {
  it('estado inicial: só o botão "Cancelar consulta", sem confirmação', () => {
    render(<BotaoCancelar token="tok-1" quando="segunda-feira, 5 de outubro às 10:00" />);
    expect(screen.getByRole('button', { name: 'Cancelar consulta' })).toBeTruthy();
    expect(screen.queryByRole('group')).toBeNull();
    expect(cancelarConsulta).not.toHaveBeenCalled();
  });

  it('clicar abre a confirmação em 2 etapas, com o "quando" na pergunta e foco no "Sim, cancelar"', async () => {
    const user = userEvent.setup();
    render(<BotaoCancelar token="tok-1" quando="segunda-feira, 5 de outubro às 10:00" />);
    await user.click(screen.getByRole('button', { name: 'Cancelar consulta' }));

    expect(screen.getByRole('group')).toBeTruthy();
    expect(screen.getByText(/Cancelar a consulta de segunda-feira, 5 de outubro às 10:00\?/)).toBeTruthy();
    const simBotao = await screen.findByRole('button', { name: /Sim, cancelar/ });
    expect(document.activeElement).toBe(simBotao);
    expect(cancelarConsulta).not.toHaveBeenCalled();
  });

  it('"Manter consulta" volta ao estado inicial sem chamar a Server Action', async () => {
    const user = userEvent.setup();
    render(<BotaoCancelar token="tok-1" quando="hoje" />);
    await user.click(screen.getByRole('button', { name: 'Cancelar consulta' }));
    await user.click(screen.getByRole('button', { name: 'Manter consulta' }));

    expect(screen.getByRole('button', { name: 'Cancelar consulta' })).toBeTruthy();
    expect(screen.queryByRole('group')).toBeNull();
    expect(cancelarConsulta).not.toHaveBeenCalled();
  });

  it('"Sim, cancelar" chama cancelarConsulta(token) e, no sucesso, router.refresh()', async () => {
    cancelarConsulta.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<BotaoCancelar token="tok-abc" quando="hoje" />);
    await user.click(screen.getByRole('button', { name: 'Cancelar consulta' }));
    await user.click(screen.getByRole('button', { name: /Sim, cancelar/ }));

    expect(cancelarConsulta).toHaveBeenCalledWith('tok-abc');
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('erro da Server Action: mostra a mensagem em role=alert, sem refresh', async () => {
    cancelarConsulta.mockResolvedValue({ ok: false, mensagem: 'Prazo de cancelamento esgotado.' });
    const user = userEvent.setup();
    render(<BotaoCancelar token="tok-abc" quando="hoje" />);
    await user.click(screen.getByRole('button', { name: 'Cancelar consulta' }));
    await user.click(screen.getByRole('button', { name: /Sim, cancelar/ }));

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Prazo de cancelamento esgotado.');
    expect(refresh).not.toHaveBeenCalled();
  });
});
