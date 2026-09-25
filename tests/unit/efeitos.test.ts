/**
 * lib/agendamento/efeitos.ts — `efeitosDe()` isola Google e e-mail: um NUNCA
 * pode impedir o outro (ADR-002). Testado com os dois módulos mockados —
 * o comportamento de resiliência não depende do banco.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sincronizarAgendamento = vi.fn();
const processarFila = vi.fn();
const excecao = vi.fn();

vi.mock('@/lib/calendar/sincronizar', () => ({ sincronizarAgendamento: (...a: unknown[]) => sincronizarAgendamento(...a) }));
vi.mock('@/lib/notificacoes/fila', () => ({ processarFila: (...a: unknown[]) => processarFila(...a) }));
vi.mock('@/lib/log', () => ({ log: { excecao: (...a: unknown[]) => excecao(...a), info: vi.fn(), aviso: vi.fn(), erro: vi.fn() } }));

const { efeitosDe } = await import('@/lib/agendamento/efeitos');

describe('efeitosDe', () => {
  beforeEach(() => { sincronizarAgendamento.mockReset(); processarFila.mockReset(); excecao.mockReset(); });

  it('caminho feliz: sincroniza com o Google e processa a fila de e-mail, nessa ordem', async () => {
    const ordem: string[] = [];
    sincronizarAgendamento.mockImplementation(async () => { ordem.push('google'); return 'synced'; });
    processarFila.mockImplementation(async () => { ordem.push('email'); return { sent: 1 }; });

    await efeitosDe('ag-1');

    expect(sincronizarAgendamento).toHaveBeenCalledWith('ag-1');
    expect(processarFila).toHaveBeenCalledWith({ appointmentId: 'ag-1' });
    expect(ordem).toEqual(['google', 'email']);
    expect(excecao).not.toHaveBeenCalled();
  });

  it('Google fora do ar (lança): o e-mail SAI mesmo assim, e a falha só é logada', async () => {
    sincronizarAgendamento.mockRejectedValue(new Error('Google indisponível (503)'));
    processarFila.mockResolvedValue({ sent: 1 });

    await expect(efeitosDe('ag-2')).resolves.toBeUndefined();

    expect(processarFila).toHaveBeenCalledWith({ appointmentId: 'ag-2' });
    expect(excecao).toHaveBeenCalledWith('efeitos.google', expect.any(Error), { agendamento: 'ag-2' });
  });

  it('Resend fora do ar (lança): não afeta o resultado, e a falha é logada — nunca propaga', async () => {
    sincronizarAgendamento.mockResolvedValue('synced');
    processarFila.mockRejectedValue(new Error('Resend indisponível (503)'));

    await expect(efeitosDe('ag-3')).resolves.toBeUndefined();

    expect(excecao).toHaveBeenCalledWith('efeitos.email', expect.any(Error), { agendamento: 'ag-3' });
  });

  it('as DUAS integrações falhando: nenhuma lança, as duas são logadas separadamente', async () => {
    sincronizarAgendamento.mockRejectedValue(new Error('google'));
    processarFila.mockRejectedValue(new Error('resend'));

    await expect(efeitosDe('ag-4')).resolves.toBeUndefined();

    expect(excecao).toHaveBeenCalledWith('efeitos.google', expect.any(Error), { agendamento: 'ag-4' });
    expect(excecao).toHaveBeenCalledWith('efeitos.email', expect.any(Error), { agendamento: 'ag-4' });
    expect(excecao).toHaveBeenCalledTimes(2);
  });
});
