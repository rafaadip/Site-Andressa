// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormBloquear, type Afetado } from '@/components/admin/FormBloquear';

const acaoBloquear = vi.fn();
vi.mock('@/app/admin/(painel)/acoes', () => ({
  acaoBloquear: (...args: unknown[]) => acaoBloquear(...args),
}));

afterEach(() => {
  cleanup();
  acaoBloquear.mockReset();
});

const AFETADOS: Afetado[] = [
  { id: 'ag-1', hora: '09:00', nome: 'Maria Silva', tipo: 'Consulta' },
  { id: 'ag-2', hora: '10:00', nome: 'João Souza', tipo: 'Retorno' },
];

describe('<FormBloquear>', () => {
  it('sem consultas afetadas: só o botão de confirmar, sem decisões nem recado', () => {
    render(<FormBloquear inicio="2026-09-25T12:00:00.000Z" fim="2026-09-25T18:00:00.000Z" nota="Resto do dia" afetados={[]} />);
    expect(screen.getByRole('button', { name: 'Confirmar bloqueio' })).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByLabelText(/Recado aos pacientes/)).toBeNull();
  });

  it('com consultas afetadas: uma decisão por consulta, sem valor padrão', () => {
    render(<FormBloquear inicio="2026-09-25T12:00:00.000Z" fim="2026-09-25T18:00:00.000Z" nota="" afetados={AFETADOS} />);

    expect(screen.getByText('Há 2 consultas neste período. Decida o que fazer com cada uma.')).toBeTruthy();
    for (const a of AFETADOS) {
      const grupo = screen.getByRole('group', { name: new RegExp(a.nome) });
      const radios = Array.from(grupo.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
      expect(radios).toHaveLength(2);
      expect(radios.every((r) => !r.checked)).toBe(true);
      expect(radios.every((r) => r.required)).toBe(true);
    }
  });

  it('singular: "Há 1 consulta" (sem plural)', () => {
    render(<FormBloquear inicio="i" fim="f" nota="" afetados={[AFETADOS[0]!]} />);
    expect(screen.getByText(/^Há 1 consulta /)).toBeTruthy();
  });

  it('decide cancelar para uma e manter para outra; envia decisao:<id> e o recado', async () => {
    acaoBloquear.mockResolvedValue({ ok: 'Bloqueado.' });
    const user = userEvent.setup();
    render(<FormBloquear inicio="2026-09-25T12:00:00.000Z" fim="2026-09-25T18:00:00.000Z" nota="Plantão" afetados={AFETADOS} />);

    const grupo1 = screen.getByRole('group', { name: /Maria Silva/ });
    await user.click(within(grupo1).getByLabelText('Cancelar e avisar o paciente'));
    const grupo2 = screen.getByRole('group', { name: /João Souza/ });
    await user.click(within(grupo2).getByLabelText('Manter (vou atender)'));
    await user.type(screen.getByLabelText(/Recado aos pacientes cancelados/), 'Desculpe o transtorno.');
    await user.click(screen.getByRole('button', { name: 'Confirmar bloqueio' }));

    expect(acaoBloquear).toHaveBeenCalledTimes(1);
    const fd = acaoBloquear.mock.calls[0]![1] as FormData;
    expect(fd.get('inicio')).toBe('2026-09-25T12:00:00.000Z');
    expect(fd.get('fim')).toBe('2026-09-25T18:00:00.000Z');
    expect(fd.get('nota')).toBe('Plantão');
    expect(fd.get('decisao:ag-1')).toBe('cancelar');
    expect(fd.get('decisao:ag-2')).toBe('manter');
    expect(fd.get('recado')).toBe('Desculpe o transtorno.');
    expect(screen.getByRole('status').textContent).toContain('Bloqueado.');
  });

  it('mostra erro devolvido pela action', async () => {
    acaoBloquear.mockResolvedValue({ erro: 'Não foi possível concluir. Tente de novo.' });
    const user = userEvent.setup();
    render(<FormBloquear inicio="i" fim="f" nota="" afetados={[]} />);

    await user.click(screen.getByRole('button', { name: 'Confirmar bloqueio' }));

    expect(screen.getByRole('alert').textContent).toContain('Não foi possível concluir.');
  });
});
