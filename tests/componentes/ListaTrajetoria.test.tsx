// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ListaTrajetoria } from '@/components/site/ListaTrajetoria';

afterEach(cleanup);

const ITENS = [
  { onde: 'Hospital A', papel: 'Médica', quando: 'jan/2025 – jun/2025' },
  { onde: 'Hospital B', papel: 'Médica plantonista', quando: '' },
];

describe('<ListaTrajetoria>', () => {
  it('mostra o título e cada item com onde/papel', () => {
    render(<ListaTrajetoria titulo="Trajetória" itens={ITENS} />);
    expect(screen.getByRole('heading', { name: 'Trajetória' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Hospital A')).toBeTruthy();
    expect(screen.getByText('Médica')).toBeTruthy();
    expect(screen.getByText('Hospital B')).toBeTruthy();
    expect(screen.getByText('Médica plantonista')).toBeTruthy();
  });

  it('mostra "quando" apenas quando não é vazio', () => {
    render(<ListaTrajetoria titulo="Trajetória" itens={ITENS} />);
    expect(screen.getByText('jan/2025 – jun/2025')).toBeTruthy();
    // O item sem "quando" não deixa nenhum elemento extra na 2ª coluna.
    const itens = screen.getAllByRole('listitem');
    expect(itens[1]!.children).toHaveLength(1);
  });

  it('lista vazia não quebra e não renderiza itens', () => {
    render(<ListaTrajetoria titulo="Trajetória" itens={[]} />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
