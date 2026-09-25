// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SeletorHorario } from '@/components/agendamento/SeletorHorario';
import type { DiaPublico } from '@/lib/agendamento/tipos';
import { dataPorExtenso } from '@/lib/datetime-cliente';

afterEach(cleanup);

const DIAS: DiaPublico[] = [
  { data: '2026-10-05', diaSemana: 1, slots: [{ inicio: '2026-10-05T13:00:00Z', rotulo: '10:00' }, { inicio: '2026-10-05T14:00:00Z', rotulo: '11:00' }] },
  { data: '2026-10-06', diaSemana: 2, slots: [] },
];

function base(sobrepor: Partial<Parameters<typeof SeletorHorario>[0]> = {}) {
  const props: Parameters<typeof SeletorHorario>[0] = {
    disp: { estado: 'ok', dias: DIAS, degradado: false },
    dia: '2026-10-05',
    slot: null,
    fusoPaciente: null,
    podeVoltarJanela: true,
    podeAvancarJanela: true,
    aoEscolherDia: vi.fn(),
    aoEscolherSlot: vi.fn(),
    aoMudarJanela: vi.fn(),
    aoTentarDeNovo: vi.fn(),
    ...sobrepor,
  };
  return props;
}

describe('<SeletorHorario>', () => {
  it('estado carregando: aria-busy e sem grupos de dia/horário', () => {
    render(<SeletorHorario {...base({ disp: { estado: 'carregando' } })} />);
    expect(screen.getByText(/Horários de Brasília/).closest('[aria-busy]')?.getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('estado erro: mensagem e botão "Tentar de novo" chama aoTentarDeNovo', async () => {
    const user = userEvent.setup();
    const aoTentarDeNovo = vi.fn();
    render(<SeletorHorario {...base({ disp: { estado: 'erro' }, aoTentarDeNovo })} />);
    expect(screen.getByText('Não conseguimos carregar os horários.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect(aoTentarDeNovo).toHaveBeenCalledTimes(1);
  });

  it('lista os dias como radios, com aria-disabled nos dias sem horário', () => {
    render(<SeletorHorario {...base()} />);
    const dias = screen.getAllByRole('radio', { name: /horário/ });
    // 1º dia livre, 2º sem horários
    const diaLivre = dias.find((d) => d.getAttribute('aria-label')?.includes('2 horários'))!;
    const diaVazio = dias.find((d) => d.getAttribute('aria-label')?.includes('sem horários'))!;
    expect(diaLivre.getAttribute('aria-disabled')).toBeNull();
    expect(diaVazio.getAttribute('aria-disabled')).toBe('true');
  });

  it('clicar num dia com horário chama aoEscolherDia; dia sem horário não chama nada ao clicar', async () => {
    const user = userEvent.setup();
    const aoEscolherDia = vi.fn();
    render(<SeletorHorario {...base({ aoEscolherDia })} />);
    await user.click(screen.getByRole('radio', { name: /sem horários/ }));
    expect(aoEscolherDia).not.toHaveBeenCalled();
    await user.click(screen.getByRole('radio', { name: /2 horários/ }));
    expect(aoEscolherDia).toHaveBeenCalledTimes(1);
    expect(aoEscolherDia).toHaveBeenCalledWith('2026-10-05');
  });

  it('mostra os horários do dia selecionado, com título por extenso', () => {
    render(<SeletorHorario {...base()} />);
    expect(screen.getByText(dataPorExtenso('2026-10-05', 1))).toBeTruthy();
    expect(screen.getByRole('radio', { name: '10:00' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '11:00' })).toBeTruthy();
  });

  it('clicar num horário chama aoEscolherSlot com o slot inteiro', async () => {
    const user = userEvent.setup();
    const aoEscolherSlot = vi.fn();
    render(<SeletorHorario {...base({ aoEscolherSlot })} />);
    await user.click(screen.getByRole('radio', { name: '10:00' }));
    expect(aoEscolherSlot).toHaveBeenCalledWith({ inicio: '2026-10-05T13:00:00Z', rotulo: '10:00' });
  });

  it('sem dia escolhido: pede para escolher um dia, sem lançar', () => {
    render(<SeletorHorario {...base({ dia: null })} />);
    expect(screen.getByText('Escolha um dia para ver os horários.')).toBeTruthy();
  });

  it('sem horários em nenhum dia da janela: estado vazio, com WhatsApp e "ver próximos dias" quando pode avançar', () => {
    const dias: DiaPublico[] = [{ data: '2026-10-05', diaSemana: 1, slots: [] }];
    render(<SeletorHorario {...base({ disp: { estado: 'ok', dias, degradado: false }, dia: null, podeAvancarJanela: true })} />);
    expect(screen.getByText('Sem horários livres nestes dias.')).toBeTruthy();
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Ver próximos dias/ })).toBeTruthy();
  });

  it('sem horários e sem poder avançar: não oferece "ver próximos dias"', () => {
    const dias: DiaPublico[] = [{ data: '2026-10-05', diaSemana: 1, slots: [] }];
    render(<SeletorHorario {...base({ disp: { estado: 'ok', dias, degradado: false }, dia: null, podeAvancarJanela: false })} />);
    expect(screen.queryByRole('button', { name: /Ver próximos dias/ })).toBeNull();
  });

  it('degradado: mostra o aviso de agenda em atualização', () => {
    render(<SeletorHorario {...base({ disp: { estado: 'ok', dias: DIAS, degradado: true } })} />);
    expect(screen.getByText(/agenda está sendo atualizada/)).toBeTruthy();
  });

  it('sem degradado: não mostra o aviso', () => {
    render(<SeletorHorario {...base()} />);
    expect(screen.queryByText(/agenda está sendo atualizada/)).toBeNull();
  });

  it('botões de navegação de janela chamam aoMudarJanela(-1|1) e respeitam habilitado', async () => {
    const user = userEvent.setup();
    const aoMudarJanela = vi.fn();
    render(<SeletorHorario {...base({ aoMudarJanela, podeVoltarJanela: false, podeAvancarJanela: true })} />);
    const voltar = screen.getByRole('button', { name: 'Dias anteriores' });
    const avancar = screen.getByRole('button', { name: 'Próximos dias' });
    expect(voltar.hasAttribute('disabled')).toBe(true);
    await user.click(avancar);
    expect(aoMudarJanela).toHaveBeenCalledWith(1);
  });

  it('fusoPaciente: mostra a nota de fuso e a hora convertida ao lado de cada horário', () => {
    render(<SeletorHorario {...base({ fusoPaciente: 'America/Cuiaba' })} />);
    expect(screen.getByText(/no seu fuso/)).toBeTruthy();
  });

  it('com erro: mensagem em role=alert ligada ao grupo de horários por aria-describedby', () => {
    render(<SeletorHorario {...base({ erro: 'Escolha um horário para continuar.' })} />);
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toBe('Escolha um horário para continuar.');
    const grupo = document.getElementById('grupo-horarios');
    expect(grupo?.getAttribute('aria-describedby')).toBe('erro-horario');
  });

  it('navegação por seta entre os dias chama aoEscolherDia (via navegarRadio, pulando os sem horário)', async () => {
    const user = userEvent.setup();
    const aoEscolherDia = vi.fn();
    const tresDias: DiaPublico[] = [
      { data: '2026-10-05', diaSemana: 1, slots: [{ inicio: '2026-10-05T13:00:00Z', rotulo: '10:00' }] },
      { data: '2026-10-06', diaSemana: 2, slots: [] },
      { data: '2026-10-07', diaSemana: 3, slots: [{ inicio: '2026-10-07T13:00:00Z', rotulo: '10:00' }] },
    ];
    render(<SeletorHorario {...base({ disp: { estado: 'ok', dias: tresDias, degradado: false }, dia: '2026-10-05', aoEscolherDia })} />);
    const diaAtivo = document.getElementById('grupo-dias')!.querySelector('[aria-checked="true"]') as HTMLElement;
    diaAtivo.focus();
    await user.keyboard('{ArrowRight}');
    // pula 06/10 (sem horário) e vai direto para 07/10
    expect(aoEscolherDia).toHaveBeenCalledWith('2026-10-07');
  });
});
