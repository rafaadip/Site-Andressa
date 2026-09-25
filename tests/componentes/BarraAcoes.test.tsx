// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BarraAcoes, BotaoAcao } from '@/components/agendamento/BarraAcoes';

afterEach(cleanup);

describe('<BarraAcoes>', () => {
  it('renderiza os filhos', () => {
    render(<BarraAcoes><button type="button">Ação</button></BarraAcoes>);
    expect(screen.getByRole('button', { name: 'Ação' })).toBeTruthy();
  });
});

describe('<BotaoAcao>', () => {
  it('clique chama onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<BotaoAcao onClick={onClick}>Continuar</BotaoAcao>);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('type padrão é "button" (não envia formulário sem querer)', () => {
    render(<BotaoAcao onClick={vi.fn()}>Continuar</BotaoAcao>);
    expect(screen.getByRole('button', { name: 'Continuar' }).getAttribute('type')).toBe('button');
  });

  it('tipo="submit" fica com type=submit', () => {
    render(<BotaoAcao tipo="submit" onClick={vi.fn()}>Confirmar</BotaoAcao>);
    expect(screen.getByRole('button', { name: 'Confirmar' }).getAttribute('type')).toBe('submit');
  });

  it('ocupado: disabled e aria-busy, onClick não dispara ao clicar', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<BotaoAcao onClick={onClick} ocupado>Confirmando…</BotaoAcao>);
    const botao = screen.getByRole('button', { name: 'Confirmando…' });
    expect(botao.hasAttribute('disabled')).toBe(true);
    expect(botao.getAttribute('aria-busy')).toBe('true');
    await user.click(botao);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('pendente: fica aria-disabled mas continua focável e clicável (o clique explica o que falta)', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<BotaoAcao onClick={onClick} pendente>Continuar</BotaoAcao>);
    const botao = screen.getByRole('button', { name: 'Continuar' });
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(botao.hasAttribute('disabled')).toBe(false);
    await user.click(botao);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('sem ocupado/pendente: nem disabled nem aria-* de estado', () => {
    render(<BotaoAcao onClick={vi.fn()}>Continuar</BotaoAcao>);
    const botao = screen.getByRole('button', { name: 'Continuar' });
    expect(botao.hasAttribute('disabled')).toBe(false);
    expect(botao.getAttribute('aria-busy')).toBeNull();
    expect(botao.getAttribute('aria-disabled')).toBeNull();
  });
});
