// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormFalta } from '@/components/admin/FormFalta';

const acaoFalta = vi.fn();
vi.mock('@/app/admin/(painel)/acoes', () => ({
  acaoFalta: (...args: unknown[]) => acaoFalta(...args),
}));

afterEach(() => {
  cleanup();
  acaoFalta.mockReset();
});

describe('<FormFalta>', () => {
  it('quando não faltou, mostra "Marcar falta" e envia falta=1', async () => {
    acaoFalta.mockResolvedValue({ ok: 'Falta registrada.' });
    const user = userEvent.setup();
    const { container } = render(<FormFalta id="ag-1" faltou={false} />);

    expect(screen.getByRole('button', { name: 'Marcar falta' })).toBeTruthy();
    expect((container.querySelector('input[name="id"]') as HTMLInputElement).value).toBe('ag-1');
    expect((container.querySelector('input[name="falta"]') as HTMLInputElement).value).toBe('1');

    await user.click(screen.getByRole('button', { name: 'Marcar falta' }));

    expect(acaoFalta).toHaveBeenCalledTimes(1);
    const fd = acaoFalta.mock.calls[0]![1] as FormData;
    expect(fd.get('id')).toBe('ag-1');
    expect(fd.get('falta')).toBe('1');
    expect(screen.getByRole('status').textContent).toContain('Falta registrada.');
  });

  it('quando já faltou, mostra "Desfazer falta" e envia falta=0', async () => {
    acaoFalta.mockResolvedValue({ ok: 'Falta desfeita.' });
    const user = userEvent.setup();
    const { container } = render(<FormFalta id="ag-2" faltou />);

    expect(screen.getByRole('button', { name: 'Desfazer falta' })).toBeTruthy();
    expect((container.querySelector('input[name="falta"]') as HTMLInputElement).value).toBe('0');

    await user.click(screen.getByRole('button', { name: 'Desfazer falta' }));

    const fd = acaoFalta.mock.calls[0]![1] as FormData;
    expect(fd.get('falta')).toBe('0');
    expect(screen.getByRole('status').textContent).toContain('Falta desfeita.');
  });

  it('mostra erro devolvido pela action', async () => {
    acaoFalta.mockResolvedValue({ erro: 'Não foi possível concluir. Tente de novo.' });
    const user = userEvent.setup();
    render(<FormFalta id="ag-3" faltou={false} />);

    await user.click(screen.getByRole('button', { name: 'Marcar falta' }));

    expect(screen.getByRole('alert').textContent).toContain('Não foi possível concluir.');
  });
});
