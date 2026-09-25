// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorDia } from '@/components/admin/EditorDia';
import type { Faixa } from '@/lib/agendamento/admin';

const acaoSalvarDia = vi.fn();
vi.mock('@/app/admin/(painel)/acoes', () => ({
  acaoSalvarDia: (...args: unknown[]) => acaoSalvarDia(...args),
}));

afterEach(() => {
  cleanup();
  acaoSalvarDia.mockReset();
});

function faixasDoFormulario(container: HTMLElement): Faixa[] {
  const campo = container.querySelector('input[name="faixas"]') as HTMLInputElement;
  return JSON.parse(campo.value) as Faixa[];
}

describe('<EditorDia>', () => {
  it('sem faixas, mostra "Sem atendimento."', () => {
    render(<EditorDia dia={1} nome="Segunda" inicial={[]} />);
    expect(screen.getByText('Sem atendimento.')).toBeTruthy();
  });

  it('mostra uma faixa existente com início, fim e modalidade', () => {
    const inicial: Faixa[] = [{ inicio: '09:00', fim: '12:00', modalidade: 'in_person' }];
    render(<EditorDia dia={1} nome="Segunda" inicial={inicial} />);

    expect((screen.getByLabelText(/Das/) as HTMLInputElement).value).toBe('09:00');
    expect((screen.getByLabelText(/às/) as HTMLInputElement).value).toBe('12:00');
    expect((screen.getByLabelText(/Modalidade/) as HTMLSelectElement).value).toBe('in_person');
  });

  it('serializa o campo oculto "faixas" com o estado inicial', () => {
    const inicial: Faixa[] = [{ inicio: '09:00', fim: '12:00', modalidade: 'telehealth' }];
    const { container } = render(<EditorDia dia={2} nome="Terça" inicial={inicial} />);
    expect(faixasDoFormulario(container)).toEqual(inicial);
    expect((container.querySelector('input[name="dia"]') as HTMLInputElement).value).toBe('2');
  });

  it('adicionar faixa acrescenta uma nova linha, a partir do fim da última', async () => {
    const inicial: Faixa[] = [{ inicio: '09:00', fim: '12:00', modalidade: 'in_person' }];
    const user = userEvent.setup();
    const { container } = render(<EditorDia dia={1} nome="Segunda" inicial={inicial} />);

    await user.click(screen.getByRole('button', { name: 'Adicionar faixa' }));

    const faixas = faixasDoFormulario(container);
    expect(faixas).toHaveLength(2);
    expect(faixas[1]).toEqual({ inicio: '12:00', fim: '12:00', modalidade: 'in_person' });
  });

  it('adicionar a primeira faixa (sem nenhuma antes) começa às 09:00', async () => {
    const user = userEvent.setup();
    const { container } = render(<EditorDia dia={1} nome="Segunda" inicial={[]} />);

    await user.click(screen.getByRole('button', { name: 'Adicionar faixa' }));

    expect(faixasDoFormulario(container)).toEqual([{ inicio: '09:00', fim: '12:00', modalidade: 'in_person' }]);
  });

  it('remover uma faixa a tira da lista e do campo serializado', async () => {
    const inicial: Faixa[] = [
      { inicio: '09:00', fim: '12:00', modalidade: 'in_person' },
      { inicio: '14:00', fim: '18:00', modalidade: 'telehealth' },
    ];
    const user = userEvent.setup();
    const { container } = render(<EditorDia dia={1} nome="Segunda" inicial={inicial} />);

    await user.click(screen.getByRole('button', { name: 'Remover faixa 09:00–12:00' }));

    expect(faixasDoFormulario(container)).toEqual([inicial[1]]);
  });

  it('remover a única faixa volta a mostrar "Sem atendimento."', async () => {
    const inicial: Faixa[] = [{ inicio: '09:00', fim: '12:00', modalidade: 'in_person' }];
    const user = userEvent.setup();
    render(<EditorDia dia={1} nome="Segunda" inicial={inicial} />);

    await user.click(screen.getByRole('button', { name: 'Remover faixa 09:00–12:00' }));

    expect(screen.getByText('Sem atendimento.')).toBeTruthy();
  });

  it('trocar a modalidade para "ambas" atualiza o campo serializado', async () => {
    const inicial: Faixa[] = [{ inicio: '09:00', fim: '12:00', modalidade: 'in_person' }];
    const user = userEvent.setup();
    const { container } = render(<EditorDia dia={1} nome="Segunda" inicial={inicial} />);

    await user.selectOptions(screen.getByLabelText(/Modalidade/), 'ambas');

    expect(faixasDoFormulario(container)[0]!.modalidade).toBe('ambas');
  });

  it('editar o horário de início de uma faixa não altera as demais', async () => {
    const inicial: Faixa[] = [
      { inicio: '09:00', fim: '12:00', modalidade: 'in_person' },
      { inicio: '14:00', fim: '18:00', modalidade: 'telehealth' },
    ];
    const user = userEvent.setup();
    const { container } = render(<EditorDia dia={1} nome="Segunda" inicial={inicial} />);

    const inicio = screen.getAllByLabelText(/Das/)[0]!;
    await user.clear(inicio);
    await user.type(inicio, '08:30');

    const faixas = faixasDoFormulario(container);
    expect(faixas[0]!.inicio).toBe('08:30');
    expect(faixas[1]).toEqual(inicial[1]);
  });

  it('editar o horário de fim atualiza o campo serializado', async () => {
    const inicial: Faixa[] = [{ inicio: '09:00', fim: '12:00', modalidade: 'in_person' }];
    const user = userEvent.setup();
    const { container } = render(<EditorDia dia={1} nome="Segunda" inicial={inicial} />);

    const fim = screen.getByLabelText(/às/);
    await user.clear(fim);
    await user.type(fim, '13:30');

    expect(faixasDoFormulario(container)[0]!.fim).toBe('13:30');
  });

  it('salvar envia o dia e as faixas serializadas; mostra o resultado', async () => {
    acaoSalvarDia.mockResolvedValue({ ok: 'Salvo.' });
    const inicial: Faixa[] = [{ inicio: '09:00', fim: '12:00', modalidade: 'in_person' }];
    const user = userEvent.setup();
    render(<EditorDia dia={3} nome="Quarta" inicial={inicial} />);

    await user.click(screen.getByRole('button', { name: /Salvar quarta/ }));

    expect(acaoSalvarDia).toHaveBeenCalledTimes(1);
    const fd = acaoSalvarDia.mock.calls[0]![1] as FormData;
    expect(fd.get('dia')).toBe('3');
    expect(JSON.parse(fd.get('faixas') as string)).toEqual(inicial);
    expect(screen.getByRole('status').textContent).toContain('Salvo.');
  });

  it('mostra erro devolvido pela action', async () => {
    acaoSalvarDia.mockResolvedValue({ erro: 'Faixas inválidas.' });
    const user = userEvent.setup();
    render(<EditorDia dia={1} nome="Segunda" inicial={[]} />);

    await user.click(screen.getByRole('button', { name: /Salvar segunda/ }));

    expect(screen.getByRole('alert').textContent).toContain('Faixas inválidas.');
  });
});
