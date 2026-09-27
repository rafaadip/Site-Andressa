// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormularioContato } from '@/components/site/FormularioContato';
import { MSG_CONTATO } from '@/lib/validation/contato';

let abrir: ReturnType<typeof vi.fn>;
let enviarApi: ReturnType<typeof vi.fn>;
beforeEach(() => {
  abrir = vi.fn().mockReturnValue({ opener: window });
  enviarApi = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('open', abrir);
  vi.stubGlobal('fetch', enviarApi);
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
  await user.click(screen.getByRole('checkbox', { name: /Autorizo o consultório/ }));
}

describe('<FormularioContato>', () => {
  it('enviar vazio mostra os obrigatórios (e o consentimento), foca o nome e não envia nada', async () => {
    const user = userEvent.setup();
    render(<FormularioContato />);
    await user.click(enviar());

    for (const msg of [MSG_CONTATO.nome, MSG_CONTATO.sobrenome, MSG_CONTATO.email, MSG_CONTATO.idade, MSG_CONTATO.motivo, MSG_CONTATO.consentimento]) {
      expect(screen.getByText(msg)).toBeTruthy();
    }
    expect(screen.queryByText(MSG_CONTATO.telefone)).toBeNull();
    expect(campo(/^Nome/)).toBe(document.activeElement);
    expect(campo(/^Nome/).getAttribute('aria-invalid')).toBe('true');
    expect(abrir).not.toHaveBeenCalled();
    expect(enviarApi).not.toHaveBeenCalled();
  });

  it('sem marcar o consentimento, não envia', async () => {
    const user = userEvent.setup();
    render(<FormularioContato />);
    await preencherObrigatorios(user);
    await user.click(screen.getByRole('checkbox', { name: /Autorizo o consultório/ }));   // desmarca
    await user.click(enviar());
    expect(screen.getByText(MSG_CONTATO.consentimento)).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Autorizo o consultório/ })).toBe(document.activeElement);
    expect(abrir).not.toHaveBeenCalled();
    expect(enviarApi).not.toHaveBeenCalled();
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
    // 'noopener' faria window.open devolver null e parecer bloqueado; o
    // opener é cortado na janela aberta.
    expect(recursos).toBeUndefined();
    expect(abrir.mock.results[0]!.value.opener).toBeNull();
    const texto = new URL(url as string).searchParams.get('text')!;
    expect(texto).toContain('Nome: Maria da Silva');
    expect(texto).toContain('Idade: 34 anos');
    expect(texto).toContain('Preferência de horário: Noite');
    expect(texto).toContain('Motivo: Emagrecimento');
    expect(texto).not.toContain('Telefone');
    expect(screen.getByRole('status').textContent).toMatch(/Abrimos o WhatsApp/);

    // Registro no painel: POST JSON com keepalive, isca vazia.
    expect(enviarApi).toHaveBeenCalledTimes(1);
    const [rota, opcoes] = enviarApi.mock.calls[0]!;
    expect(rota).toBe('/api/contatos');
    expect(opcoes).toMatchObject({ method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' } });
    expect(JSON.parse(opcoes.body as string)).toMatchObject({ nome: 'Maria', motivo: 'emagrecimento', horario: 'noite', consentimento: true, site: '' });
    expect(await screen.findByText(/ficou registrado para o consultório/)).toBeTruthy();
  });

  it('se o registro falhar, o WhatsApp abre do mesmo jeito (o paciente nunca fica sem canal)', async () => {
    enviarApi.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    render(<FormularioContato />);
    await preencherObrigatorios(user);
    await user.click(enviar());
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/ficou registrado/)).toBeNull();
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
