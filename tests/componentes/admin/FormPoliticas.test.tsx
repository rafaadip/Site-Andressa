// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormPoliticas } from '@/components/admin/FormPoliticas';

const acaoSalvarPoliticas = vi.fn();
vi.mock('@/app/admin/(painel)/acoes', () => ({
  acaoSalvarPoliticas: (...args: unknown[]) => acaoSalvarPoliticas(...args),
}));

const POLITICAS = { lead: 24, horizonte: 60, prazo: 12, sala: 'https://meet.google.com/abc-defg', motivoNoEvento: true };

afterEach(() => {
  cleanup();
  acaoSalvarPoliticas.mockReset();
});

describe('<FormPoliticas>', () => {
  it('pré-preenche os campos com os valores atuais', () => {
    render(<FormPoliticas p={POLITICAS} />);
    expect((screen.getByLabelText(/Antecedência mínima/) as HTMLInputElement).value).toBe('24');
    expect((screen.getByLabelText(/Agenda aberta/) as HTMLInputElement).value).toBe('60');
    expect((screen.getByLabelText(/Cancelar pelo link até/) as HTMLInputElement).value).toBe('12');
    expect((screen.getByLabelText(/Link fixo da sala/) as HTMLInputElement).value).toBe('https://meet.google.com/abc-defg');
    expect((screen.getByRole('checkbox', { name: /Incluir o motivo/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('envia os números editados e o estado atual do checkbox', async () => {
    acaoSalvarPoliticas.mockResolvedValue({ ok: 'Políticas salvas.' });
    const user = userEvent.setup();
    render(<FormPoliticas p={POLITICAS} />);

    const antecedencia = screen.getByLabelText(/Antecedência mínima/);
    await user.clear(antecedencia);
    await user.type(antecedencia, '48');
    await user.click(screen.getByRole('checkbox', { name: /Incluir o motivo/ }));
    await user.click(screen.getByRole('button', { name: 'Salvar políticas' }));

    expect(acaoSalvarPoliticas).toHaveBeenCalledTimes(1);
    const fd = acaoSalvarPoliticas.mock.calls[0]![1] as FormData;
    expect(fd.get('antecedencia')).toBe('48');
    expect(fd.get('horizonte')).toBe('60');
    expect(fd.get('prazo')).toBe('12');
    expect(fd.get('motivoNoEvento')).toBeNull(); // estava marcado; um clique desmarca
    expect(screen.getByRole('status').textContent).toContain('Políticas salvas.');
  });

  it('a sala de teleconsulta é opcional (pode ficar vazia)', () => {
    render(<FormPoliticas p={{ ...POLITICAS, sala: '' }} />);
    expect((screen.getByLabelText(/Link fixo da sala/) as HTMLInputElement).value).toBe('');
  });

  it('mostra erro devolvido pela action', async () => {
    acaoSalvarPoliticas.mockResolvedValue({ erro: 'Não foi possível concluir. Tente de novo.' });
    const user = userEvent.setup();
    render(<FormPoliticas p={POLITICAS} />);

    await user.click(screen.getByRole('button', { name: 'Salvar políticas' }));

    expect(screen.getByRole('alert').textContent).toContain('Não foi possível concluir.');
  });
});
