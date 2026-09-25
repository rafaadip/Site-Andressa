// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SeletorModalidade } from '@/components/agendamento/SeletorModalidade';
import { localConsulta } from '@/lib/config';
import type { TipoConsultaPublico } from '@/lib/agendamento/tipos';

afterEach(cleanup);

const TIPOS: TipoConsultaPublico[] = [
  { slug: 'presencial', label: 'Consulta presencial', duracaoMin: 60, modalidade: 'in_person' },
  { slug: 'tele', label: 'Teleconsulta', duracaoMin: 30, modalidade: 'telehealth' },
];

describe('<SeletorModalidade>', () => {
  it('renderiza um radio por tipo, com rótulo, duração e o local (presencial)', () => {
    render(<SeletorModalidade tipos={TIPOS} selecionado={null} aoSelecionar={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(screen.getByText('Consulta presencial')).toBeTruthy();
    expect(screen.getByText('60 min')).toBeTruthy();
    expect(screen.getByText('Teleconsulta')).toBeTruthy();
    expect(screen.getByText('30 min')).toBeTruthy();
    expect(screen.getByText(localConsulta('in_person'))).toBeTruthy();
  });

  it('nenhum vem marcado quando `selecionado` é null; roving tabindex cai no primeiro', () => {
    render(<SeletorModalidade tipos={TIPOS} selecionado={null} aoSelecionar={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]!.getAttribute('aria-checked')).toBe('false');
    expect(radios[1]!.getAttribute('aria-checked')).toBe('false');
    expect(radios[0]!.tabIndex).toBe(0);
    expect(radios[1]!.tabIndex).toBe(-1);
  });

  it('marca o tipo selecionado e move o roving tabindex para ele', () => {
    render(<SeletorModalidade tipos={TIPOS} selecionado="tele" aoSelecionar={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]!.getAttribute('aria-checked')).toBe('false');
    expect(radios[1]!.getAttribute('aria-checked')).toBe('true');
    expect(radios[0]!.tabIndex).toBe(-1);
    expect(radios[1]!.tabIndex).toBe(0);
  });

  it('clicar chama aoSelecionar com o slug, sem avançar nada sozinho', async () => {
    const user = userEvent.setup();
    const aoSelecionar = vi.fn();
    render(<SeletorModalidade tipos={TIPOS} selecionado={null} aoSelecionar={aoSelecionar} />);
    await user.click(screen.getByRole('radio', { name: /Teleconsulta/ }));
    expect(aoSelecionar).toHaveBeenCalledTimes(1);
    expect(aoSelecionar).toHaveBeenCalledWith('tele');
  });

  it('navegação por seta entre as opções chama aoSelecionar (via navegarRadio)', async () => {
    const user = userEvent.setup();
    const aoSelecionar = vi.fn();
    render(<SeletorModalidade tipos={TIPOS} selecionado="presencial" aoSelecionar={aoSelecionar} />);
    const radios = screen.getAllByRole('radio');
    radios[0]!.focus();
    await user.keyboard('{ArrowRight}');
    expect(aoSelecionar).toHaveBeenCalledTimes(1);
    expect(aoSelecionar).toHaveBeenCalledWith('tele');
  });

  it('sem erro: nenhum alerta e sem aria-describedby no grupo', () => {
    render(<SeletorModalidade tipos={TIPOS} selecionado={null} aoSelecionar={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('radiogroup').getAttribute('aria-describedby')).toBeNull();
  });

  it('com erro: mensagem em role=alert e ligada ao grupo por aria-describedby', () => {
    render(<SeletorModalidade tipos={TIPOS} selecionado={null} aoSelecionar={vi.fn()} erro="Escolha uma modalidade para continuar." />);
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toBe('Escolha uma modalidade para continuar.');
    expect(screen.getByRole('radiogroup').getAttribute('aria-describedby')).toBe('erro-modalidade');
    expect(alerta.id).toBe('erro-modalidade');
  });
});
