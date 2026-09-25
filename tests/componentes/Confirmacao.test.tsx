// @vitest-environment jsdom
import { createRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Confirmacao } from '@/components/agendamento/Confirmacao';
import type { AgendamentoConfirmado } from '@/lib/agendamento/tipos';
import { PROFISSIONAL } from '@/lib/config';
import { linkWhatsApp } from '@/lib/contato';

afterEach(cleanup);

const AG: AgendamentoConfirmado = {
  id: 'ag-1',
  inicio: '2026-10-05T13:00:00Z',
  fim: '2026-10-05T14:00:00Z',
  quando: 'segunda-feira, 5 de outubro às 10:00',
  tipo: 'Consulta presencial',
  modalidade: 'in_person',
  local: 'Consultório em Guarulhos – SP (endereço enviado na confirmação)',
  urlGestao: 'https://site.example/consulta/tok123',
  urlIcs: 'https://site.example/api/ics/tok123',
  urlGoogle: 'https://calendar.google.com/render?...',
  prazoCancelamentoHoras: 24,
};

describe('<Confirmacao>', () => {
  it('mostra o nome (primeiro nome), quando e tipo/local da consulta', () => {
    render(<Confirmacao ag={AG} nome="Maria Souza" />);
    expect(screen.getByRole('heading', { name: /Consulta confirmada, Maria/ })).toBeTruthy();
    expect(screen.getByText(AG.quando)).toBeTruthy();
    expect(screen.getByText(`${AG.tipo} · ${AG.local}`)).toBeTruthy();
  });

  it('sem nome: título de confirmação sem vírgula sobrando', () => {
    render(<Confirmacao ag={AG} nome="" />);
    const titulo = screen.getByRole('heading', { level: 2 });
    expect(titulo.textContent).toBe('Consulta confirmada');
  });

  it('o título recebe a ref encaminhada (foco programático na troca de etapa)', () => {
    const ref = createRef<HTMLHeadingElement>();
    render(<Confirmacao ref={ref} ag={AG} nome="Maria" />);
    expect(ref.current).toBe(screen.getByRole('heading', { level: 2 }));
    expect(ref.current?.tabIndex).toBe(-1);
  });

  it('links de calendário apontam para as URLs do agendamento', () => {
    render(<Confirmacao ag={AG} nome="Maria" />);
    expect(screen.getByRole('link', { name: /Google Agenda/ }).getAttribute('href')).toBe(AG.urlGoogle);
    expect(screen.getByRole('link', { name: /iPhone, Outlook e outros/ }).getAttribute('href')).toBe(AG.urlIcs);
  });

  it('link do WhatsApp inclui o tipo, o quando e o nome', () => {
    render(<Confirmacao ag={AG} nome="Maria Souza" />);
    const link = screen.getByRole('link', { name: /Avisar pelo WhatsApp/ });
    const href = decodeURIComponent(link.getAttribute('href') ?? '');
    expect(href.startsWith(linkWhatsApp())).toBe(true);
    expect(href).toContain(PROFISSIONAL.nomeCurto);
    expect(href).toContain(AG.tipo);
    expect(href).toContain(AG.quando);
    expect(href).toContain('Maria Souza');
  });

  it('mostra o link de gestão em um campo somente leitura, com o prazo de cancelamento', () => {
    render(<Confirmacao ag={AG} nome="Maria" />);
    const campo = screen.getByRole('textbox', { name: 'Link da sua consulta' }) as HTMLInputElement;
    expect(campo.value).toBe(AG.urlGestao);
    expect(campo.readOnly).toBe(true);
    expect(screen.getByText(/até 24 horas antes/)).toBeTruthy();
  });

  describe('copiar link', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('copia para a área de transferência e mostra "Copiado" por alguns segundos', async () => {
      vi.useFakeTimers();
      const escrever = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: escrever } });

      render(<Confirmacao ag={AG} nome="Maria" />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
        await Promise.resolve(); // deixa a promise de writeText() resolver
      });

      expect(escrever).toHaveBeenCalledWith(AG.urlGestao);
      expect(screen.getByRole('button', { name: 'Copiado' })).toBeTruthy();

      await act(async () => { vi.advanceTimersByTime(4000); });
      expect(screen.getByRole('button', { name: 'Copiar' })).toBeTruthy();
    });

    it('sem permissão de clipboard: não quebra, o link continua visível', async () => {
      const escrever = vi.fn().mockRejectedValue(new Error('sem permissão'));
      vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: escrever } });

      render(<Confirmacao ag={AG} nome="Maria" />);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
        await Promise.resolve().then(() => Promise.resolve());
      });

      expect(screen.getByRole('textbox', { name: 'Link da sua consulta' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Copiar' })).toBeTruthy();
    });
  });
});
