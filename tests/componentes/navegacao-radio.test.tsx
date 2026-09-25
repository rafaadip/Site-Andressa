// @vitest-environment jsdom
/**
 * `navegarRadio` é usado por `SeletorModalidade`, `SeletorHorario` (dias e
 * horários): setas movem o foco E selecionam, Home/End vão às pontas,
 * opções com aria-disabled são puladas (WAI-ARIA APG).
 */
import { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { navegarRadio } from '@/components/agendamento/navegacao-radio';

afterEach(cleanup);

/** Harness mínimo: um `role="radiogroup"` com roving tabindex de verdade. */
function GrupoTeste({ desabilitar }: { desabilitar?: string }) {
  const [sel, setSel] = useState('a');
  const opcoes = ['a', 'b', 'c', 'd'];
  return (
    <div role="radiogroup" aria-label="Opções" tabIndex={-1} onKeyDown={navegarRadio}>
      {opcoes.map((v) => (
        <button
          key={v}
          role="radio"
          aria-checked={sel === v}
          aria-disabled={v === desabilitar || undefined}
          tabIndex={sel === v ? 0 : -1}
          onClick={() => v !== desabilitar && setSel(v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

describe('navegarRadio', () => {
  it('ArrowRight/ArrowDown move o foco para a próxima opção e a selecionam', async () => {
    const user = userEvent.setup();
    render(<GrupoTeste />);
    const [a, b] = screen.getAllByRole('radio');
    a!.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(b);
    expect(b!.getAttribute('aria-checked')).toBe('true');
  });

  it('ArrowDown também avança (equivalente a ArrowRight)', async () => {
    const user = userEvent.setup();
    render(<GrupoTeste />);
    const [a, b] = screen.getAllByRole('radio');
    a!.focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(b);
  });

  it('ArrowLeft/ArrowUp voltam para a opção anterior', async () => {
    const user = userEvent.setup();
    render(<GrupoTeste />);
    const [a, b] = screen.getAllByRole('radio');
    b!.focus();
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(a);
  });

  it('avança em ciclo: da última opção, ArrowRight volta para a primeira', async () => {
    const user = userEvent.setup();
    render(<GrupoTeste />);
    const opcoes = screen.getAllByRole('radio');
    const ultima = opcoes[opcoes.length - 1]!;
    ultima.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(opcoes[0]);
  });

  it('recua em ciclo: da primeira opção, ArrowLeft vai para a última', async () => {
    const user = userEvent.setup();
    render(<GrupoTeste />);
    const opcoes = screen.getAllByRole('radio');
    opcoes[0]!.focus();
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(opcoes[opcoes.length - 1]);
  });

  it('Home vai para a primeira opção; End vai para a última', async () => {
    const user = userEvent.setup();
    render(<GrupoTeste />);
    const opcoes = screen.getAllByRole('radio');
    opcoes[2]!.focus();
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(opcoes[0]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(opcoes[opcoes.length - 1]);
  });

  it('pula opções com aria-disabled ao navegar', async () => {
    const user = userEvent.setup();
    render(<GrupoTeste desabilitar="b" />);
    const [a, , c] = screen.getAllByRole('radio');
    a!.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(c); // pulou "b"
  });

  it('teclas fora do conjunto (ex.: letras) não movem o foco', async () => {
    const user = userEvent.setup();
    render(<GrupoTeste />);
    const [a] = screen.getAllByRole('radio');
    a!.focus();
    await user.keyboard('x');
    expect(document.activeElement).toBe(a);
  });

  it('grupo vazio (sem opções focáveis) não lança erro', () => {
    render(<div role="radiogroup" aria-label="Vazio" tabIndex={-1} onKeyDown={navegarRadio} />);
    const grupo = screen.getByRole('radiogroup');
    grupo.focus();
    expect(() => {
      grupo.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    }).not.toThrow();
  });

  // BUG: quando o próprio grupo está com foco (não uma opção — é o que
  // `focarGrupo()` faz em FluxoAgendamento.tsx ao validar sem seleção),
  // `radios.indexOf(document.activeElement)` devolve -1. Para ArrowRight
  // isso cai certinho na primeira opção ((-1+1) % n === 0), mas para
  // ArrowLeft a conta ((-1-1+n) % n) aterrissa na PENÚLTIMA opção em vez da
  // ÚLTIMA — o padrão usual de "nada selecionado, seta para trás → vai para
  // o fim" (components/agendamento/navegacao-radio.ts:21). Reproduzir:
  // focar o `role="radiogroup"` (não um `role="radio"` dentro dele) e
  // apertar ArrowLeft/ArrowUp.
  it.fails('BUG: ArrowLeft com o grupo (não uma opção) focado deveria ir para a última opção', () => {
    render(<GrupoTeste />);
    const grupo = screen.getByRole('radiogroup');
    const opcoes = screen.getAllByRole('radio');
    grupo.focus();
    expect(document.activeElement).toBe(grupo);
    grupo.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(opcoes[opcoes.length - 1]);
  });
});
