// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SincronizarAgora, DesconectarGoogle } from '@/components/admin/AcoesIntegracao';

const acaoSincronizarAgora = vi.fn();
const acaoDesconectarGoogle = vi.fn();
vi.mock('@/app/admin/(painel)/acoes', () => ({
  acaoSincronizarAgora: (...args: unknown[]) => acaoSincronizarAgora(...args),
  acaoDesconectarGoogle: (...args: unknown[]) => acaoDesconectarGoogle(...args),
}));

afterEach(() => {
  cleanup();
  acaoSincronizarAgora.mockReset();
  acaoDesconectarGoogle.mockReset();
});

describe('<SincronizarAgora>', () => {
  it('ao enviar, chama a action e mostra o resultado', async () => {
    acaoSincronizarAgora.mockResolvedValue({ ok: 'Sincronizado. 2 mudança(s) lida(s) · 1 consulta(s) enviada(s).' });
    const user = userEvent.setup();
    render(<SincronizarAgora />);

    await user.click(screen.getByRole('button', { name: 'Sincronizar agora' }));

    expect(acaoSincronizarAgora).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toContain('Sincronizado.');
  });

  it('mostra erro da action', async () => {
    acaoSincronizarAgora.mockResolvedValue({ erro: 'Não foi possível concluir. Tente de novo.' });
    const user = userEvent.setup();
    render(<SincronizarAgora />);

    await user.click(screen.getByRole('button', { name: 'Sincronizar agora' }));

    expect(screen.getByRole('alert').textContent).toContain('Não foi possível concluir.');
  });
});

describe('<DesconectarGoogle>', () => {
  it('começa fechado: só o botão "Desconectar…", sem chamar a action', () => {
    render(<DesconectarGoogle />);
    expect(screen.getByRole('button', { name: 'Desconectar…' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Sim, desconectar/ })).toBeNull();
    expect(acaoDesconectarGoogle).not.toHaveBeenCalled();
  });

  it('ao clicar em "Desconectar…", abre a confirmação com aviso e as duas saídas', async () => {
    const user = userEvent.setup();
    render(<DesconectarGoogle />);

    await user.click(screen.getByRole('button', { name: 'Desconectar…' }));

    expect(screen.getByText(/Sem a agenda, o site não enxerga seus plantões/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sim, desconectar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Manter conectada' })).toBeTruthy();
  });

  it('"Manter conectada" fecha a confirmação sem chamar a action', async () => {
    const user = userEvent.setup();
    render(<DesconectarGoogle />);

    await user.click(screen.getByRole('button', { name: 'Desconectar…' }));
    await user.click(screen.getByRole('button', { name: 'Manter conectada' }));

    expect(screen.getByRole('button', { name: 'Desconectar…' })).toBeTruthy();
    expect(acaoDesconectarGoogle).not.toHaveBeenCalled();
  });

  it('"Sim, desconectar" chama a action e mostra o resultado', async () => {
    acaoDesconectarGoogle.mockResolvedValue({ ok: 'Agenda desconectada. As consultas existentes continuam marcadas.' });
    const user = userEvent.setup();
    render(<DesconectarGoogle />);

    await user.click(screen.getByRole('button', { name: 'Desconectar…' }));
    await user.click(screen.getByRole('button', { name: 'Sim, desconectar' }));

    expect(acaoDesconectarGoogle).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status').textContent).toContain('Agenda desconectada.');
  });
});
