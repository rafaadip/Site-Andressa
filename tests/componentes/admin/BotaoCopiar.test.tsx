// @vitest-environment jsdom
/**
 * jsdom não implementa a Clipboard API; `userEvent.setup()` instala seu
 * próprio stub em `navigator.clipboard` (um getter só-leitura, sem setter).
 * Por isso o "clipboard mockado" aqui é: ler de volta com `readText()` no
 * caminho feliz, e espionar `writeText` com `vi.spyOn` para simular falha de
 * permissão — nunca sobrescrever `navigator.clipboard` na mão (isso lançaria
 * "Cannot set property clipboard … which has only a getter" depois que
 * qualquer teste anterior tiver chamado `userEvent.setup()`).
 *
 * Combinar `userEvent.click()` com fake timers trava (o próprio user-event
 * usa timers reais internamente); por isso o teste do timeout de 3s clica
 * com `fireEvent` — só depois de `userEvent.setup()` já ter instalado o
 * stub de clipboard.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BotaoCopiar } from '@/components/admin/BotaoCopiar';

afterEach(cleanup);

describe('<BotaoCopiar>', () => {
  it('rótulo padrão "Copiar dados"', () => {
    render(<BotaoCopiar texto="dado" />);
    expect(screen.getByRole('button', { name: 'Copiar dados' })).toBeTruthy();
  });

  it('aceita rótulo customizado', () => {
    render(<BotaoCopiar texto="dado" rotulo="Copiar telefone" />);
    expect(screen.getByRole('button', { name: 'Copiar telefone' })).toBeTruthy();
  });

  it('ao clicar, copia o texto para a área de transferência e mostra "Copiado"', async () => {
    const user = userEvent.setup();
    render(<BotaoCopiar texto="(11) 91234-5678" />);

    await user.click(screen.getByRole('button', { name: 'Copiar dados' }));

    expect(await navigator.clipboard.readText()).toBe('(11) 91234-5678');
    expect(screen.getByRole('button', { name: 'Copiado' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Dados copiados.');
  });

  it('depois de 3s volta ao rótulo original', async () => {
    userEvent.setup(); // só para instalar o stub de clipboard
    vi.useFakeTimers();
    render(<BotaoCopiar texto="dado" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copiar dados' }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole('button', { name: 'Copiado' })).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByRole('button', { name: 'Copiar dados' })).toBeTruthy();

    vi.useRealTimers();
  });

  it('sem permissão do navegador (clipboard rejeita): não quebra e mantém o rótulo original', async () => {
    const user = userEvent.setup();
    render(<BotaoCopiar texto="dado" />);
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('sem permissão'));

    await user.click(screen.getByRole('button', { name: 'Copiar dados' }));

    expect(screen.getByRole('button', { name: 'Copiar dados' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Copiado' })).toBeNull();
  });
});
