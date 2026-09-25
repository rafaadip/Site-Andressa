// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BotaoEnviar } from '@/components/admin/BotaoEnviar';

afterEach(cleanup);

describe('<BotaoEnviar>', () => {
  it('é um botão de submit com o texto passado', () => {
    render(
      <form>
        <BotaoEnviar>Salvar</BotaoEnviar>
      </form>,
    );
    const botao = screen.getByRole('button', { name: 'Salvar' });
    expect(botao.getAttribute('type')).toBe('submit');
  });

  it('aceita name/value (usado quando o mesmo formulário tem mais de um botão)', () => {
    render(
      <form>
        <BotaoEnviar name="acao" value="confirmar">Confirmar</BotaoEnviar>
      </form>,
    );
    const botao = screen.getByRole('button', { name: 'Confirmar' });
    expect(botao.getAttribute('name')).toBe('acao');
    expect(botao.getAttribute('value')).toBe('confirmar');
  });

  it('fora de um <form> não fica pendente: habilitado e sem aria-busy', () => {
    render(<BotaoEnviar>Enviar</BotaoEnviar>);
    const botao = screen.getByRole('button', { name: 'Enviar' });
    expect(botao.hasAttribute('disabled')).toBe(false);
    expect(botao.getAttribute('aria-busy')).toBeNull();
  });

  it('durante o envio (useFormStatus pending): desabilita e marca aria-busy, sem clique duplo', async () => {
    const user = userEvent.setup();
    let resolverAcao: () => void = () => {};
    const acao = () => new Promise<void>((resolve) => { resolverAcao = resolve; });

    render(
      <form action={acao}>
        <BotaoEnviar>Enviar</BotaoEnviar>
      </form>,
    );

    const botao = screen.getByRole('button', { name: 'Enviar' });
    expect(botao.hasAttribute('disabled')).toBe(false);

    await user.click(botao);

    // Enquanto a Server Action não resolve, o botão fica desabilitado.
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button').getAttribute('aria-busy')).toBe('true');

    await act(async () => {
      resolverAcao();
      await Promise.resolve();
    });

    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button').getAttribute('aria-busy')).toBeNull();
  });
});
