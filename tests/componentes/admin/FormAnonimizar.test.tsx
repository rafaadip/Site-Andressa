// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormAnonimizar } from '@/components/admin/FormAnonimizar';

const acaoAnonimizar = vi.fn();
vi.mock('@/app/admin/(painel)/acoes', () => ({
  acaoAnonimizar: (...args: unknown[]) => acaoAnonimizar(...args),
}));

afterEach(() => {
  cleanup();
  acaoAnonimizar.mockReset();
});

describe('<FormAnonimizar>', () => {
  it('a caixa de confirmação começa desmarcada', () => {
    render(<FormAnonimizar email="titular@example.com" />);
    const caixa = screen.getByRole('checkbox', { name: /Confirmo que o titular pediu/ }) as HTMLInputElement;
    expect(caixa.checked).toBe(false);
  });

  it('exige a confirmação: a action recebe confirmo="on" só quando marcada', async () => {
    acaoAnonimizar.mockResolvedValue({ erro: 'Marque a confirmação para eliminar os dados.' });
    const user = userEvent.setup();
    render(<FormAnonimizar email="titular@example.com" />);

    await user.click(screen.getByRole('button', { name: 'Eliminar dados' }));

    const fd = acaoAnonimizar.mock.calls[0]![1] as FormData;
    expect(fd.get('confirmo')).toBeNull();
    expect(fd.get('email')).toBe('titular@example.com');
    expect(screen.getByRole('alert').textContent).toContain('Marque a confirmação para eliminar os dados.');
  });

  it('marcando a confirmação, envia confirmo="on" e mostra o resultado', async () => {
    acaoAnonimizar.mockResolvedValue({ ok: 'Dados eliminados de 3 consulta(s).' });
    const user = userEvent.setup();
    render(<FormAnonimizar email="titular@example.com" />);

    await user.click(screen.getByRole('checkbox', { name: /Confirmo que o titular pediu/ }));
    await user.click(screen.getByRole('button', { name: 'Eliminar dados' }));

    const fd = acaoAnonimizar.mock.calls[0]![1] as FormData;
    expect(fd.get('confirmo')).toBe('on');
    expect(screen.getByRole('status').textContent).toContain('Dados eliminados de 3 consulta(s).');
  });
});
