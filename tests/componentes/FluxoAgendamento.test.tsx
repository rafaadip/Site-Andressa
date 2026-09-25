// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FluxoAgendamento } from '@/components/agendamento/FluxoAgendamento';
import type {
  AgendamentoConfirmado, DiaPublico, ErroApi, RespostaDisponibilidade, TipoConsultaPublico,
} from '@/lib/agendamento/tipos';

const TIPOS: TipoConsultaPublico[] = [
  { slug: 'presencial', label: 'Consulta presencial', duracaoMin: 60, modalidade: 'in_person' },
  { slug: 'tele', label: 'Teleconsulta', duracaoMin: 30, modalidade: 'telehealth' },
];

const DIAS: DiaPublico[] = [
  { data: '2026-10-05', diaSemana: 1, slots: [{ inicio: '2026-10-05T13:00:00Z', rotulo: '10:00' }] },
];

function disponibilidade(tipoSlug: string, dias: DiaPublico[] = DIAS, degradado = false): RespostaDisponibilidade {
  return {
    timezone: 'America/Sao_Paulo', hoje: '2026-10-01', horizonteDias: 60,
    tipo: TIPOS.find((t) => t.slug === tipoSlug)!, dias, degradado,
  };
}

const AGENDAMENTO_OK: AgendamentoConfirmado = {
  id: 'ag-1', inicio: '2026-10-05T13:00:00Z', fim: '2026-10-05T14:00:00Z',
  quando: 'segunda-feira, 5 de outubro às 10:00', tipo: 'Consulta presencial', modalidade: 'in_person',
  local: 'Consultório em Guarulhos – SP (endereço enviado na confirmação)',
  urlGestao: 'https://site.example/consulta/tok-1',
  urlIcs: 'https://site.example/api/ics/tok-1',
  urlGoogle: 'https://calendar.google.com/render?...',
  prazoCancelamentoHoras: 24,
};

/** Fake resposta de `fetch`, no formato que `Response.json()`/`.ok` exigem. */
function respostaFake(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

function props(sobrepor: Partial<Parameters<typeof FluxoAgendamento>[0]> = {}) {
  return { tipos: TIPOS, hoje: '2026-10-01', fuso: 'America/Sao_Paulo', horizonteDias: 60, ...sobrepor };
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
  Element.prototype.scrollIntoView = vi.fn();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Passa da etapa 1 (modalidade) para a 2 (dia/horário) já com os dias carregados. */
async function irParaEtapa2(user: ReturnType<typeof userEvent.setup>, rotuloModalidade = /Consulta presencial/) {
  await user.click(screen.getByRole('radio', { name: rotuloModalidade }));
  await user.click(screen.getByRole('button', { name: /Continuar/ }));
  await screen.findByRole('heading', { name: 'Escolha o dia e o horário' });
  await screen.findByRole('radio', { name: /10:00/ }); // espera o fetch de disponibilidade resolver
}

/** Passa da etapa 2 para a 3 (dados), com um dia/horário já escolhidos. */
async function irParaEtapa3(user: ReturnType<typeof userEvent.setup>) {
  await irParaEtapa2(user);
  await user.click(screen.getByRole('radio', { name: /10:00/ }));
  await user.click(screen.getByRole('button', { name: /Continuar/ }));
  await screen.findByRole('heading', { name: 'Para quem é a consulta?' });
}

async function preencherFormularioValido(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: /Nome completo/ }), 'Maria Souza');
  await user.type(screen.getByRole('textbox', { name: /Celular \/ WhatsApp/ }), '11998053826');
  await user.type(screen.getByRole('textbox', { name: /E-mail/ }), 'maria@example.com');
  await user.click(screen.getByRole('checkbox', { name: /Autorizo o uso do meu nome/ }));
}

describe('<FluxoAgendamento>', () => {
  it('etapa 1: pede a modalidade; indicador de etapas mostra "1. Modalidade" como atual', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(<FluxoAgendamento {...props()} />);
    expect(screen.getByRole('heading', { name: 'Como você prefere ser atendido(a)?' })).toBeTruthy();
    const passoAtual = screen.getByText('1. Modalidade').closest('li');
    expect(passoAtual?.getAttribute('aria-current')).toBe('step');
  });

  it('continuar sem escolher modalidade: mostra erro e foca o grupo', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const user = userEvent.setup();
    render(<FluxoAgendamento {...props()} />);
    await user.click(screen.getByRole('button', { name: /Continuar/ }));

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Escolha uma modalidade para continuar.');
    await waitFor(() => expect(document.activeElement?.id).toBe('grupo-modalidade'));
  });

  it('escolher modalidade e continuar: busca a disponibilidade e mostra os horários', async () => {
    const fetchFn = vi.fn().mockResolvedValue(respostaFake(200, disponibilidade('presencial')));
    vi.stubGlobal('fetch', fetchFn);
    const user = userEvent.setup();
    render(<FluxoAgendamento {...props()} />);

    await irParaEtapa2(user);
    expect(fetchFn).toHaveBeenCalledWith(expect.stringContaining('/api/disponibilidade?tipo=presencial'), expect.any(Object));
    expect(screen.getByText(/Consulta presencial · 60 min/)).toBeTruthy();
  });

  it('continuar sem escolher horário: mostra erro específico', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaFake(200, disponibilidade('presencial'))));
    const user = userEvent.setup();
    render(<FluxoAgendamento {...props()} />);
    await irParaEtapa2(user);
    await user.click(screen.getByRole('button', { name: /Continuar/ }));

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Escolha um horário para continuar.');
  });

  it('com um único tipo de consulta, a modalidade já vem selecionada (sem precisar escolher)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaFake(200, disponibilidade('presencial'))));
    const user = userEvent.setup();
    render(<FluxoAgendamento {...props({ tipos: [TIPOS[0]!] })} />);
    await user.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(await screen.findByRole('heading', { name: 'Escolha o dia e o horário' })).toBeTruthy();
  });

  it('escolher dia e horário e continuar: vai para a etapa "Seus dados" com o resumo da escolha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaFake(200, disponibilidade('presencial'))));
    const user = userEvent.setup();
    render(<FluxoAgendamento {...props()} />);
    await irParaEtapa3(user);

    expect(screen.getByText('Consulta presencial')).toBeTruthy();
    expect(screen.getByText(/às/).textContent).toContain('10:00');
  });

  it('confirmar com sucesso (201): mostra a tela de confirmação com os dados retornados', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(respostaFake(200, disponibilidade('presencial')))
      .mockResolvedValueOnce(respostaFake(201, AGENDAMENTO_OK));
    vi.stubGlobal('fetch', fetchFn);
    const user = userEvent.setup();
    render(<FluxoAgendamento {...props()} />);
    await irParaEtapa3(user);
    await preencherFormularioValido(user);
    await user.click(screen.getByRole('button', { name: /Confirmar agendamento/ }));

    expect(await screen.findByRole('heading', { name: /Consulta confirmada, Maria/ })).toBeTruthy();
    const chamadaPost = fetchFn.mock.calls.find((chamada) => chamada[0] === '/api/agendamentos');
    expect(chamadaPost).toBeTruthy();
    const init = chamadaPost![1] as RequestInit & { headers: Record<string, string> };
    expect(init).toMatchObject({ method: 'POST' });
    expect(init.headers['Idempotency-Key']).toBeTruthy();
  });

  it('409 (horário ocupado): volta para a etapa 2 com aviso, mantém os dados e libera novo horário', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(respostaFake(200, disponibilidade('presencial')))
      .mockResolvedValueOnce(respostaFake(409, { erro: 'SLOT_INDISPONIVEL', mensagem: 'Ocupado' } satisfies ErroApi))
      .mockResolvedValueOnce(respostaFake(200, disponibilidade('presencial')));
    vi.stubGlobal('fetch', fetchFn);
    const user = userEvent.setup();
    render(<FluxoAgendamento {...props()} />);
    await irParaEtapa3(user);
    await preencherFormularioValido(user);
    await user.click(screen.getByRole('button', { name: /Confirmar agendamento/ }));

    expect(await screen.findByRole('heading', { name: 'Escolha o dia e o horário' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Esse horário acabou de ser reservado por outra pessoa.');
    // Nenhum horário fica marcado como escolhido (o 409 zera o slot).
    expect(screen.queryByRole('radio', { checked: true, name: /10:00/ })).toBeNull();
  });

  it('422 com erros de campo: mostra as mensagens no formulário e permanece na etapa 3', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(respostaFake(200, disponibilidade('presencial')))
      .mockResolvedValueOnce(respostaFake(422, {
        erro: 'VALIDACAO', mensagem: 'Dados inválidos.', campos: { email: 'Informe um e-mail válido, ex.: nome@exemplo.com.' },
      } satisfies ErroApi));
    vi.stubGlobal('fetch', fetchFn);
    const user = userEvent.setup();
    render(<FluxoAgendamento {...props()} />);
    await irParaEtapa3(user);
    await preencherFormularioValido(user);
    await user.click(screen.getByRole('button', { name: /Confirmar agendamento/ }));

    expect(await screen.findByRole('heading', { name: 'Para quem é a consulta?' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Informe um e-mail válido, ex.: nome@exemplo.com.');
    const campoEmail = screen.getByRole('textbox', { name: /E-mail/ });
    expect(campoEmail.getAttribute('aria-invalid')).toBe('true');
  });

  it('429 (limite excedido): mostra a mensagem do servidor, sem link de "tentar de novo"', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(respostaFake(200, disponibilidade('presencial')))
      .mockResolvedValueOnce(respostaFake(429, { erro: 'LIMITE', mensagem: 'Muitas tentativas. Aguarde um pouco.' } satisfies ErroApi));
    vi.stubGlobal('fetch', fetchFn);
    const user = userEvent.setup();
    render(<FluxoAgendamento {...props()} />);
    await irParaEtapa3(user);
    await preencherFormularioValido(user);
    await user.click(screen.getByRole('button', { name: /Confirmar agendamento/ }));

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Muitas tentativas. Aguarde um pouco.'));
    expect(screen.queryByRole('button', { name: /Tentar de novo/ })).toBeNull();
  });

  it('falha de rede: mostra aviso de conexão com "Tentar de novo" e link do WhatsApp', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(respostaFake(200, disponibilidade('presencial')))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchFn);
    const user = userEvent.setup();
    render(<FluxoAgendamento {...props()} />);
    await irParaEtapa3(user);
    await preencherFormularioValido(user);
    await user.click(screen.getByRole('button', { name: /Confirmar agendamento/ }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('A conexão falhou. Tente de novo — não haverá agendamento duplicado.'),
    );
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Agendar pelo WhatsApp' })).toBeTruthy();
  });

  it('degradado: repassa o aviso de agenda em atualização para o SeletorHorario', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaFake(200, disponibilidade('presencial', DIAS, true))));
    const user = userEvent.setup();
    render(<FluxoAgendamento {...props()} />);
    await irParaEtapa2(user);
    expect(screen.getByText(/agenda está sendo atualizada/)).toBeTruthy();
  });

  it('"Voltar" na etapa 2 retorna para a etapa 1 sem perder a modalidade escolhida', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaFake(200, disponibilidade('tele'))));
    const user = userEvent.setup();
    render(<FluxoAgendamento {...props()} />);
    await irParaEtapa2(user, /Teleconsulta/);
    await user.click(screen.getByRole('button', { name: /Voltar/ }));

    await screen.findByRole('heading', { name: 'Como você prefere ser atendido(a)?' });
    expect(screen.getByRole('radio', { name: /Teleconsulta/ }).getAttribute('aria-checked')).toBe('true');
  });
});
