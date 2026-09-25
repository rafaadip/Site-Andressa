// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormCancelar } from '@/components/admin/FormCancelar';

const acaoCancelar = vi.fn();
vi.mock('@/app/admin/(painel)/acoes', () => ({
  acaoCancelar: (...args: unknown[]) => acaoCancelar(...args),
}));

afterEach(() => {
  cleanup();
  acaoCancelar.mockReset();
});

describe('<FormCancelar>', () => {
  it('começa fechado: só o botão "Cancelar consulta…"', () => {
    render(<FormCancelar id="ag-1" futura />);
    expect(screen.getByRole('button', { name: 'Cancelar consulta…' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sim, cancelar' })).toBeNull();
  });

  it('ao abrir, mostra o recado opcional e "Manter consulta"', async () => {
    const user = userEvent.setup();
    render(<FormCancelar id="ag-1" futura />);

    await user.click(screen.getByRole('button', { name: 'Cancelar consulta…' }));

    expect(screen.getByRole('heading', { name: 'Cancelar esta consulta?' })).toBeTruthy();
    expect(screen.getByLabelText(/Recado ao paciente/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sim, cancelar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Manter consulta' })).toBeTruthy();
  });

  it('"Manter consulta" fecha o formulário sem chamar a action', async () => {
    const user = userEvent.setup();
    render(<FormCancelar id="ag-1" futura />);

    await user.click(screen.getByRole('button', { name: 'Cancelar consulta…' }));
    await user.click(screen.getByRole('button', { name: 'Manter consulta' }));

    expect(screen.getByRole('button', { name: 'Cancelar consulta…' })).toBeTruthy();
    expect(acaoCancelar).not.toHaveBeenCalled();
  });

  it('consulta futura: checkbox "avisar" aparece marcada por padrão', async () => {
    const user = userEvent.setup();
    render(<FormCancelar id="ag-1" futura />);

    await user.click(screen.getByRole('button', { name: 'Cancelar consulta…' }));

    const avisar = screen.getByRole('checkbox', { name: /Avisar o paciente por e-mail/ }) as HTMLInputElement;
    expect(avisar.checked).toBe(true);
  });

  it('consulta passada (não futura): sem checkbox de aviso', async () => {
    const user = userEvent.setup();
    render(<FormCancelar id="ag-1" futura={false} />);

    await user.click(screen.getByRole('button', { name: 'Cancelar consulta…' }));

    expect(screen.queryByRole('checkbox', { name: /Avisar o paciente/ })).toBeNull();
  });

  it('confirmar envia id, recado e avisar; mostra o resultado', async () => {
    acaoCancelar.mockResolvedValue({ ok: 'Cancelada.' });
    const user = userEvent.setup();
    render(<FormCancelar id="ag-9" futura />);

    await user.click(screen.getByRole('button', { name: 'Cancelar consulta…' }));
    await user.type(screen.getByLabelText(/Recado ao paciente/), 'Surgiu um imprevisto.');
    await user.click(screen.getByRole('button', { name: 'Sim, cancelar' }));

    expect(acaoCancelar).toHaveBeenCalledTimes(1);
    const fd = acaoCancelar.mock.calls[0]![1] as FormData;
    expect(fd.get('id')).toBe('ag-9');
    expect(fd.get('recado')).toBe('Surgiu um imprevisto.');
    expect(fd.get('avisar')).toBe('on');
    expect(screen.getByRole('status').textContent).toContain('Cancelada.');
  });

  it('desmarcando o aviso, a action recebe avisar ausente', async () => {
    acaoCancelar.mockResolvedValue({ ok: 'Cancelada.' });
    const user = userEvent.setup();
    render(<FormCancelar id="ag-9" futura />);

    await user.click(screen.getByRole('button', { name: 'Cancelar consulta…' }));
    await user.click(screen.getByRole('checkbox', { name: /Avisar o paciente/ }));
    await user.click(screen.getByRole('button', { name: 'Sim, cancelar' }));

    const fd = acaoCancelar.mock.calls[0]![1] as FormData;
    expect(fd.get('avisar')).toBeNull();
  });

  it('mostra erro devolvido pela action', async () => {
    acaoCancelar.mockResolvedValue({ erro: 'Não foi possível concluir. Tente de novo.' });
    const user = userEvent.setup();
    render(<FormCancelar id="ag-9" futura />);

    await user.click(screen.getByRole('button', { name: 'Cancelar consulta…' }));
    await user.click(screen.getByRole('button', { name: 'Sim, cancelar' }));

    expect(screen.getByRole('alert').textContent).toContain('Não foi possível concluir.');
  });
});
