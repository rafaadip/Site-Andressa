// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormularioContato } from '@/components/site/FormularioContato';
import { MSG_CONTATO } from '@/lib/validation/contato';

let abrir: ReturnType<typeof vi.fn>;
beforeEach(() => {
  abrir = vi.fn().mockReturnValue({});
  vi.stubGlobal('open', abrir);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const campo = (nome: RegExp) => screen.getByRole('textbox', { name: nome });
const enviar = () => screen.getByRole('button', { name: 'Enviar pelo WhatsApp' });

async function preencherObrigatorios(user: ReturnType<typeof userEvent.setup>) {
  await user.type(campo(/^Nome/), 'Maria');
  await user.type(campo(/^Sobrenome/), 'da Silva');
  await user.type(campo(/^E-mail/), 'maria@exemplo.com');
  await user.type(campo(/^Idade/), '34');
  await user.selectOptions(screen.getByRole('combobox', { name: /Motivo da consulta/ }), 'Emagrecimento');
}

describe('<FormularioContato>', () => {
  it('enviar vazio mostra os 5 obrigatórios, foca o nome e não abre o WhatsApp', async () => {
    const user = userEvent.setup();
    render(<FormularioContato />);
    await user.click(enviar());

    for (const msg of [MSG_CONTATO.nome, MSG_CONTATO.sobrenome, MSG_CONTATO.email, MSG_CONTATO.idade, MSG_CONTATO.motivo]) {
      expect(screen.getByText(msg)).toBeTruthy();
    }
    expect(screen.queryByText(MSG_CONTATO.telefone)).toBeNull();
    expect(campo(/^Nome/)).toBe(document.activeElement);
    expect(campo(/^Nome/).getAttribute('aria-invalid')).toBe('true');
    expect(abrir).not.toHaveBeenCalled();
  });

  it('erro aparece ao sair do campo, não antes', async () => {
    const user = userEvent.setup();
    render(<FormularioContato />);
    await user.type(campo(/^E-mail/), 'maria@');
    expect(screen.queryByText(MSG_CONTATO.email)).toBeNull();
    await user.tab();
    expect(screen.getByText(MSG_CONTATO.email)).toBeTruthy();
  });

  it('idade só aceita dígitos; telefone ganha máscara', async () => {
    const user = userEvent.setup();
    render(<FormularioContato />);
    await user.type(campo(/^Idade/), '3a4e5');
    expect((campo(/^Idade/) as HTMLInputElement).value).toBe('345');
    await user.type(screen.getByRole('textbox', { name: /Telefone com DDD/ }), '11912345678');
    expect((screen.getByRole('textbox', { name: /Telefone com DDD/ }) as HTMLInputElement).value).toBe('(11) 91234-5678');
  });

  it('nome com tentativa de injeção é recusado com mensagem clara', async () => {
    const user = userEvent.setup();
    render(<FormularioContato />);
    await user.type(campo(/^Nome/), "x' OR 1=1 --");
    await user.tab();
    expect(screen.getByText(MSG_CONTATO.caracteres)).toBeTruthy();
  });

  it('válido: abre o WhatsApp numa nova aba com a mensagem personalizada', async () => {
    const user = userEvent.setup();
    render(<FormularioContato />);
    await preencherObrigatorios(user);
    await user.click(screen.getByRole('radio', { name: 'Noite' }));
    await user.click(enviar());

    expect(abrir).toHaveBeenCalledTimes(1);
    const [url, alvo, recursos] = abrir.mock.calls[0]!;
    expect(alvo).toBe('_blank');
    expect(recursos).toContain('noopener');
    const texto = new URL(url as string).searchParams.get('text')!;
    expect(texto).toContain('Nome: Maria da Silva');
    expect(texto).toContain('Idade: 34 anos');
    expect(texto).toContain('Preferência de horário: Noite');
    expect(texto).toContain('Motivo: Emagrecimento');
    expect(texto).not.toContain('Telefone');
    expect(screen.getByRole('status').textContent).toMatch(/Abrimos o WhatsApp/);
  });

  it('com pop-up bloqueado, abre o WhatsApp na mesma aba', async () => {
    abrir.mockReturnValue(null);
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const user = userEvent.setup();
    render(<FormularioContato />);
    await preencherObrigatorios(user);
    await user.click(enviar());
    expect(assign).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/\d+\?text=/));
  });
});
