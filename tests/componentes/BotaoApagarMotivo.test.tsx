// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BotaoApagarMotivo } from '@/app/(site)/consulta/[token]/BotaoApagarMotivo';
import { CONFIRMAR_APAGAR_MOTIVO } from '@/lib/content/site';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

const apagarMotivo = vi.fn();
vi.mock('@/app/(site)/consulta/[token]/acoes', () => ({
  apagarMotivo: (...args: unknown[]) => apagarMotivo(...args),
}));

afterEach(() => {
  cleanup();
  refresh.mockClear();
  apagarMotivo.mockReset();
});

describe('<BotaoApagarMotivo>', () => {
  it('estado inicial: botão com o texto de site.ts, sem confirmação', () => {
    render(<BotaoApagarMotivo token="tok-1" />);
    expect(screen.getByRole('button', { name: CONFIRMAR_APAGAR_MOTIVO.botaoInicial })).toBeTruthy();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('clicar abre a confirmação de 2 etapas com a pergunta e o aviso de irreversibilidade', async () => {
    const user = userEvent.setup();
    render(<BotaoApagarMotivo token="tok-1" />);
    await user.click(screen.getByRole('button', { name: CONFIRMAR_APAGAR_MOTIVO.botaoInicial }));

    expect(screen.getByText(CONFIRMAR_APAGAR_MOTIVO.pergunta)).toBeTruthy();
    expect(screen.getByText(CONFIRMAR_APAGAR_MOTIVO.aviso)).toBeTruthy();
    const simBotao = await screen.findByRole('button', { name: new RegExp(CONFIRMAR_APAGAR_MOTIVO.botaoConfirmar) });
    expect(document.activeElement).toBe(simBotao);
  });

  it(`"${CONFIRMAR_APAGAR_MOTIVO.botaoManter}" volta ao estado inicial sem chamar a Server Action`, async () => {
    const user = userEvent.setup();
    render(<BotaoApagarMotivo token="tok-1" />);
    await user.click(screen.getByRole('button', { name: CONFIRMAR_APAGAR_MOTIVO.botaoInicial }));
    await user.click(screen.getByRole('button', { name: CONFIRMAR_APAGAR_MOTIVO.botaoManter }));

    expect(screen.getByRole('button', { name: CONFIRMAR_APAGAR_MOTIVO.botaoInicial })).toBeTruthy();
    expect(apagarMotivo).not.toHaveBeenCalled();
  });

  it('confirmar chama apagarMotivo(token) e, no sucesso, router.refresh()', async () => {
    apagarMotivo.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(<BotaoApagarMotivo token="tok-xyz" />);
    await user.click(screen.getByRole('button', { name: CONFIRMAR_APAGAR_MOTIVO.botaoInicial }));
    await user.click(screen.getByRole('button', { name: new RegExp(CONFIRMAR_APAGAR_MOTIVO.botaoConfirmar) }));

    expect(apagarMotivo).toHaveBeenCalledWith('tok-xyz');
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it('erro da Server Action: mensagem em role=alert, sem refresh', async () => {
    apagarMotivo.mockResolvedValue({ ok: false, mensagem: 'Não conseguimos apagar agora.' });
    const user = userEvent.setup();
    render(<BotaoApagarMotivo token="tok-xyz" />);
    await user.click(screen.getByRole('button', { name: CONFIRMAR_APAGAR_MOTIVO.botaoInicial }));
    await user.click(screen.getByRole('button', { name: new RegExp(CONFIRMAR_APAGAR_MOTIVO.botaoConfirmar) }));

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Não conseguimos apagar agora.');
    expect(refresh).not.toHaveBeenCalled();
  });
});
