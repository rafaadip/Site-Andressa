// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CartaoConsulta, linkWhatsPaciente, telefoneLegivel } from '@/components/admin/CartaoConsulta';
import { horaLocalParaUtc } from '@/lib/datetime';
import type { ItemAgenda } from '@/lib/agendamento/admin';

afterEach(cleanup);

function item(sobre: Partial<ItemAgenda> = {}): ItemAgenda {
  return {
    id: 'ag-1',
    inicio: horaLocalParaUtc('2026-09-25', '09:00'),
    fim: horaLocalParaUtc('2026-09-25', '09:30'),
    status: 'confirmed',
    nome: 'Maria Silva',
    telefone: '+5511912345678',
    email: 'maria@example.com',
    motivo: null,
    tipo: 'Consulta',
    modalidade: 'in_person',
    duracaoMin: 30,
    syncState: 'synced',
    emailInvalido: false,
    ...sobre,
  };
}

describe('telefoneLegivel', () => {
  it('celular com DDI 55: "(11) 91234-5678"', () => {
    expect(telefoneLegivel('+5511912345678')).toBe('(11) 91234-5678');
  });

  it('fixo (10 dígitos após remover o DDI): "(11) 1234-5678"', () => {
    expect(telefoneLegivel('+551112345678')).toBe('(11) 1234-5678');
  });

  it('formato não reconhecido: devolve o E.164 original', () => {
    expect(telefoneLegivel('+1234')).toBe('+1234');
  });
});

describe('linkWhatsPaciente', () => {
  it('sem texto: só o número em wa.me', () => {
    expect(linkWhatsPaciente('+5511912345678')).toBe('https://wa.me/5511912345678');
  });

  it('com texto: acrescenta ?text= codificado', () => {
    expect(linkWhatsPaciente('+5511912345678', 'Olá!')).toBe(
      `https://wa.me/5511912345678?text=${encodeURIComponent('Olá!')}`,
    );
  });
});

describe('<CartaoConsulta>', () => {
  it('mostra hora, nome, tipo e duração', () => {
    render(<CartaoConsulta c={item()} />);
    expect(screen.getByText('09:00')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Maria Silva' })).toBeTruthy();
    expect(screen.getByText(/Consulta · 30 min/)).toBeTruthy();
  });

  it('link tel: usa o E.164 cru e mostra o telefone formatado', () => {
    render(<CartaoConsulta c={item()} />);
    const link = screen.getByRole('link', { name: /\(11\) 91234-5678/ });
    expect(link.getAttribute('href')).toBe('tel:+5511912345678');
  });

  it('link do WhatsApp abre em nova aba, sem texto pré-preenchido', () => {
    render(<CartaoConsulta c={item()} />);
    const link = screen.getByRole('link', { name: 'WhatsApp' });
    expect(link.getAttribute('href')).toBe('https://wa.me/5511912345678');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('link de detalhes aponta para /admin/consulta/[id]', () => {
    render(<CartaoConsulta c={item({ id: 'abc-123' })} />);
    const link = screen.getByRole('link', { name: /Detalhes/ });
    expect(link.getAttribute('href')).toBe('/admin/consulta/abc-123');
  });

  it('sem motivo, não mostra a citação', () => {
    render(<CartaoConsulta c={item({ motivo: null })} />);
    expect(screen.queryByText(/Motivo:/)).toBeNull();
  });

  it('com motivo, mostra a citação entre aspas', () => {
    render(<CartaoConsulta c={item({ motivo: 'Dor de cabeça' })} />);
    expect(screen.getByText(/Dor de cabeça/)).toBeTruthy();
  });

  it('sem sinalizações, não mostra nenhum selo', () => {
    render(<CartaoConsulta c={item()} />);
    expect(screen.queryByText('Faltou')).toBeNull();
    expect(screen.queryByText('E-mail não entregue')).toBeNull();
    expect(screen.queryByText('Fora da agenda do Google')).toBeNull();
  });

  it('no_show mostra o selo "Faltou"', () => {
    render(<CartaoConsulta c={item({ status: 'no_show' })} />);
    expect(screen.getByText('Faltou')).toBeTruthy();
  });

  it('e-mail inválido mostra o selo correspondente', () => {
    render(<CartaoConsulta c={item({ emailInvalido: true })} />);
    expect(screen.getByText('E-mail não entregue')).toBeTruthy();
  });

  it('syncState "failed" mostra o selo de fora da agenda do Google', () => {
    render(<CartaoConsulta c={item({ syncState: 'failed' })} />);
    expect(screen.getByText('Fora da agenda do Google')).toBeTruthy();
  });

  it('teleconsulta usa o ícone de vídeo (presencial usa o de local)', () => {
    const { container: presencial } = render(<CartaoConsulta c={item({ modalidade: 'in_person' })} />);
    expect(presencial.querySelector('.lucide-map-pin')).toBeTruthy();
    cleanup();
    const { container: tele } = render(<CartaoConsulta c={item({ modalidade: 'telehealth' })} />);
    expect(tele.querySelector('.lucide-video')).toBeTruthy();
  });
});
