// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Resultado } from '@/components/admin/Resultado';

afterEach(cleanup);

describe('<Resultado>', () => {
  it('estado nulo não renderiza nada', () => {
    const { container } = render(<Resultado estado={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('estado vazio (nem ok nem erro) não renderiza nada', () => {
    const { container } = render(<Resultado estado={{}} />);
    expect(container.innerHTML).toBe('');
  });

  it('erro: role=alert com a mensagem', () => {
    render(<Resultado estado={{ erro: 'Não foi possível concluir.' }} />);
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toContain('Não foi possível concluir.');
    // Não deve haver status de sucesso ao mesmo tempo.
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('ok: role=status com a mensagem', () => {
    render(<Resultado estado={{ ok: 'Salvo.' }} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Salvo.');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('erro tem prioridade se ambos vierem preenchidos', () => {
    render(<Resultado estado={{ ok: 'Salvo.', erro: 'Falhou.' }} />);
    expect(screen.getByRole('alert').textContent).toContain('Falhou.');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
