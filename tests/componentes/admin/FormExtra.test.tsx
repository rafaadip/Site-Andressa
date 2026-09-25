// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormExtra } from '@/components/admin/FormExtra';

const acaoExtra = vi.fn();
vi.mock('@/app/admin/(painel)/acoes', () => ({
  acaoExtra: (...args: unknown[]) => acaoExtra(...args),
}));

afterEach(() => {
  cleanup();
  acaoExtra.mockReset();
});

describe('<FormExtra>', () => {
  it('data mínima é "hoje"', () => {
    render(<FormExtra hoje="2026-09-25" />);
    expect(screen.getByLabelText('Dia').getAttribute('min')).toBe('2026-09-25');
  });

  it('preenche e envia dia, início, fim e nota', async () => {
    acaoExtra.mockResolvedValue({ ok: 'Horário extra adicionado.' });
    const user = userEvent.setup();
    render(<FormExtra hoje="2026-09-25" />);

    await user.type(screen.getByLabelText('Dia'), '2026-09-27');
    await user.type(screen.getByLabelText('Das'), '08:00');
    await user.type(screen.getByLabelText('às'), '10:00');
    await user.type(screen.getByLabelText('Nota'), 'Mutirão de sábado');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(acaoExtra).toHaveBeenCalledTimes(1);
    const fd = acaoExtra.mock.calls[0]![1] as FormData;
    expect(fd.get('de')).toBe('2026-09-27');
    expect(fd.get('hi')).toBe('08:00');
    expect(fd.get('hf')).toBe('10:00');
    expect(fd.get('nota')).toBe('Mutirão de sábado');
    expect(screen.getByRole('status').textContent).toContain('Horário extra adicionado.');
  });

  it('a nota é opcional', async () => {
    acaoExtra.mockResolvedValue({ ok: 'Horário extra adicionado.' });
    const user = userEvent.setup();
    render(<FormExtra hoje="2026-09-25" />);

    await user.type(screen.getByLabelText('Dia'), '2026-09-27');
    await user.type(screen.getByLabelText('Das'), '08:00');
    await user.type(screen.getByLabelText('às'), '10:00');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    const fd = acaoExtra.mock.calls[0]![1] as FormData;
    expect(fd.get('nota')).toBe('');
  });

  it('mostra erro devolvido pela action', async () => {
    acaoExtra.mockResolvedValue({ erro: 'Informe o horário de início e de fim.' });
    const user = userEvent.setup();
    render(<FormExtra hoje="2026-09-25" />);

    await user.type(screen.getByLabelText('Dia'), '2026-09-27');
    await user.type(screen.getByLabelText('Das'), '08:00');
    await user.type(screen.getByLabelText('às'), '10:00');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(screen.getByRole('alert').textContent).toContain('Informe o horário de início e de fim.');
  });
});
