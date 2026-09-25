// @vitest-environment jsdom
import { useState } from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormularioDados, DADOS_VAZIOS, type Dados } from '@/components/agendamento/FormularioDados';
import { CONSENTIMENTO } from '@/lib/content/site';

afterEach(cleanup);

// `rolarParaVista` (chamado quando a sugestão de e-mail nasce) lê
// `window.matchMedia` e chama `Element.scrollIntoView` — nenhum dos dois
// existe no jsdom.
beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
  Element.prototype.scrollIntoView = vi.fn();
});

function Wrapper({ inicial = DADOS_VAZIOS }: { inicial?: Dados }) {
  const [dados, setDados] = useState(inicial);
  const [erros, setErros] = useState<Record<string, string>>({});
  return (
    <FormularioDados
      dados={dados}
      erros={erros}
      aoMudar={(campo, valor) => setDados((d) => ({ ...d, [campo]: valor }))}
      aoSair={() => setErros({})}
    />
  );
}

describe('<FormularioDados>', () => {
  it('renderiza os campos nome, telefone, e-mail e motivo, todos vazios', () => {
    render(<Wrapper />);
    expect(screen.getByRole('textbox', { name: /Nome completo/ })).toHaveProperty('value', '');
    expect(screen.getByRole('textbox', { name: /Celular \/ WhatsApp/ })).toHaveProperty('value', '');
    expect(screen.getByRole('textbox', { name: /E-mail/ })).toHaveProperty('value', '');
    expect(screen.getByRole('textbox', { name: /Motivo da consulta/ })).toHaveProperty('value', '');
  });

  it('máscara o telefone enquanto digita', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const campo = screen.getByRole('textbox', { name: /Celular \/ WhatsApp/ });
    await user.type(campo, '11998053826');
    expect(campo).toHaveProperty('value', '(11) 99805-3826');
  });

  it('sugere correção de e-mail com domínio comum errado, e "Corrigir" aplica a sugestão', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const campo = screen.getByRole('textbox', { name: /E-mail/ }) as HTMLInputElement;
    await user.type(campo, 'ana@gmial.com');
    expect(screen.getByText(/Você quis dizer/)).toBeTruthy();
    expect(screen.getByText('ana@gmail.com')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Corrigir' }));
    expect(campo.value).toBe('ana@gmail.com');
    expect(screen.queryByText(/Você quis dizer/)).toBeNull();
  });

  it('e-mail sem domínio comum errado: nenhuma sugestão aparece', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.type(screen.getByRole('textbox', { name: /E-mail/ }), 'ana@gmail.com');
    expect(screen.queryByText(/Você quis dizer/)).toBeNull();
  });

  it('contador de caracteres do motivo atualiza ao digitar', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.type(screen.getByRole('textbox', { name: /Motivo da consulta/ }), 'dor');
    expect(screen.getByText('3/500')).toBeTruthy();
  });

  it('consentimento de dados sempre aparece, com o texto e o link de privacidade de site.ts', () => {
    render(<Wrapper />);
    expect(screen.getByText(new RegExp(CONSENTIMENTO.dados.texto))).toBeTruthy();
    const link = screen.getByRole('link', { name: CONSENTIMENTO.dados.link });
    expect(link.getAttribute('href')).toBe('/politica-de-privacidade');
  });

  it('consentimento de saúde só aparece quando há motivo escrito', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    expect(screen.queryByText(CONSENTIMENTO.saude.destaque)).toBeNull();
    await user.type(screen.getByRole('textbox', { name: /Motivo da consulta/ }), 'Retorno');
    expect(screen.getByText(CONSENTIMENTO.saude.destaque)).toBeTruthy();
  });

  it('apagar o motivo some com o consentimento de saúde (e o desmarca)', async () => {
    const user = userEvent.setup();
    render(<Wrapper inicial={{ ...DADOS_VAZIOS, motivo: 'Retorno', consentimentoSaude: true }} />);
    const checkboxSaude = screen.getByRole('checkbox', { name: new RegExp(CONSENTIMENTO.saude.antes) });
    expect(checkboxSaude).toHaveProperty('checked', true);
    const motivo = screen.getByRole('textbox', { name: /Motivo da consulta/ });
    await user.clear(motivo);
    expect(screen.queryByText(CONSENTIMENTO.saude.destaque)).toBeNull();
  });

  it('erros: aria-invalid e mensagem role=alert em cada campo com erro', () => {
    render(
      <FormularioDados
        dados={DADOS_VAZIOS}
        erros={{ nome: 'Informe nome e sobrenome.', consentimentoDados: 'Para agendar, é preciso autorizar o uso dos seus dados.' }}
        aoMudar={vi.fn()}
        aoSair={vi.fn()}
      />,
    );
    const nome = screen.getByRole('textbox', { name: /Nome completo/ });
    expect(nome.getAttribute('aria-invalid')).toBe('true');
    const alertas = screen.getAllByRole('alert').map((a) => a.textContent);
    expect(alertas).toContain('Informe nome e sobrenome.');
    expect(alertas).toContain('Para agendar, é preciso autorizar o uso dos seus dados.');
  });

  it('onBlur de cada campo chama aoSair com o nome do campo', async () => {
    const user = userEvent.setup();
    const aoSair = vi.fn();
    render(<FormularioDados dados={DADOS_VAZIOS} erros={{}} aoMudar={vi.fn()} aoSair={aoSair} />);
    await user.click(screen.getByRole('textbox', { name: /Nome completo/ }));
    await user.tab();
    expect(aoSair).toHaveBeenCalledWith('nome');
  });
});
