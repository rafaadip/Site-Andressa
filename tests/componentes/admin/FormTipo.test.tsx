// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormTipo } from '@/components/admin/FormTipo';

const acaoSalvarTipo = vi.fn();
vi.mock('@/app/admin/(painel)/acoes', () => ({
  acaoSalvarTipo: (...args: unknown[]) => acaoSalvarTipo(...args),
}));

const TIPO = { id: 'tipo-1', label: 'Consulta de retorno', duracao: 30, antes: 5, depois: 5, ativo: true, modalidade: 'in_person' };

afterEach(() => {
  cleanup();
  acaoSalvarTipo.mockReset();
});

describe('<FormTipo>', () => {
  it('mostra o rótulo da modalidade e pré-preenche os campos', () => {
    render(<FormTipo t={TIPO} />);
    expect(screen.getByText('Presencial')).toBeTruthy();
    expect((screen.getByLabelText(/Nome no site/) as HTMLInputElement).value).toBe('Consulta de retorno');
    expect((screen.getByLabelText(/Duração/) as HTMLInputElement).value).toBe('30');
    expect((screen.getByRole('checkbox', { name: /Oferecer no site/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('teleconsulta mostra o rótulo correspondente', () => {
    render(<FormTipo t={{ ...TIPO, modalidade: 'telehealth' }} />);
    expect(screen.getByText('Teleconsulta')).toBeTruthy();
  });

  it('envia o id oculto e os campos editados', async () => {
    acaoSalvarTipo.mockResolvedValue({ ok: 'Modalidade salva.' });
    const user = userEvent.setup();
    const { container } = render(<FormTipo t={TIPO} />);

    const nome = screen.getByLabelText(/Nome no site/);
    await user.clear(nome);
    await user.type(nome, 'Primeira consulta');
    await user.click(screen.getByRole('checkbox', { name: /Oferecer no site/ }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect((container.querySelector('input[name="id"]') as HTMLInputElement).value).toBe('tipo-1');
    const fd = acaoSalvarTipo.mock.calls[0]![1] as FormData;
    expect(fd.get('label')).toBe('Primeira consulta');
    expect(fd.get('duracao')).toBe('30');
    expect(fd.get('ativo')).toBeNull(); // estava marcado; um clique desmarca
    expect(screen.getByRole('status').textContent).toContain('Modalidade salva.');
  });

  it('mostra erro devolvido pela action', async () => {
    acaoSalvarTipo.mockResolvedValue({ erro: 'Não foi possível concluir. Tente de novo.' });
    const user = userEvent.setup();
    render(<FormTipo t={TIPO} />);

    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByRole('alert').textContent).toContain('Não foi possível concluir.');
  });
});
