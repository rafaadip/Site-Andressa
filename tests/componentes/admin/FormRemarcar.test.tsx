// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormRemarcar, type DiaParaRemarcar } from '@/components/admin/FormRemarcar';

const acaoRemarcar = vi.fn();
vi.mock('@/app/admin/(painel)/acoes', () => ({
  acaoRemarcar: (...args: unknown[]) => acaoRemarcar(...args),
}));

afterEach(() => {
  cleanup();
  acaoRemarcar.mockReset();
});

const DIAS: DiaParaRemarcar[] = [
  { data: '2026-09-28', titulo: 'segunda-feira, 28 de setembro', slots: [{ inicio: '2026-09-28T12:00:00.000Z', rotulo: '09:00' }, { inicio: '2026-09-28T13:00:00.000Z', rotulo: '10:00' }] },
  { data: '2026-09-29', titulo: 'terça-feira, 29 de setembro', slots: [] },
];

describe('<FormRemarcar>', () => {
  it('sem nenhum dia com vaga, mostra o aviso e não há botão de enviar', () => {
    render(<FormRemarcar id="ag-1" dias={[DIAS[1]!]} />);
    expect(screen.getByText('Sem horários livres nestes dias.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('lista só os dias com vaga, com um rádio por horário', () => {
    render(<FormRemarcar id="ag-1" dias={DIAS} />);
    expect(screen.getByText(DIAS[0]!.titulo)).toBeTruthy();
    expect(screen.queryByText(DIAS[1]!.titulo)).toBeNull();
    expect(screen.getByRole('radio', { name: '09:00' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '10:00' })).toBeTruthy();
  });

  it('exige a escolha de um horário (rádios "required")', () => {
    render(<FormRemarcar id="ag-1" dias={DIAS} />);
    for (const radio of screen.getAllByRole('radio')) {
      expect((radio as HTMLInputElement).required).toBe(true);
    }
  });

  it('escolher um horário e confirmar envia id e o horário escolhido', async () => {
    acaoRemarcar.mockResolvedValue({ ok: 'Remarcada.' });
    const user = userEvent.setup();
    render(<FormRemarcar id="ag-7" dias={DIAS} />);

    await user.click(screen.getByRole('radio', { name: '10:00' }));
    await user.click(screen.getByRole('button', { name: 'Remarcar e avisar o paciente' }));

    expect(acaoRemarcar).toHaveBeenCalledTimes(1);
    const fd = acaoRemarcar.mock.calls[0]![1] as FormData;
    expect(fd.get('id')).toBe('ag-7');
    expect(fd.get('inicio')).toBe('2026-09-28T13:00:00.000Z');
    expect(screen.getByRole('status').textContent).toContain('Remarcada.');
  });

  it('mostra erro devolvido pela action', async () => {
    acaoRemarcar.mockResolvedValue({ erro: 'Esse horário não está mais livre. Escolha outro.' });
    const user = userEvent.setup();
    render(<FormRemarcar id="ag-7" dias={DIAS} />);

    await user.click(screen.getByRole('radio', { name: '09:00' }));
    await user.click(screen.getByRole('button', { name: 'Remarcar e avisar o paciente' }));

    expect(screen.getByRole('alert').textContent).toContain('Esse horário não está mais livre.');
  });
});
