/**
 * lib/api/respostas.ts — tradução de erro de domínio para HTTP. Cobre os
 * sete ramos de `traduzirErro` e confere que o erro interno NUNCA vaza
 * (mensagem, stack) para o corpo da resposta (regra de PII/segurança).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { erro, SEM_CACHE, traduzirErro } from '@/lib/api/respostas';
import {
  AgendamentoInexistenteError, IdempotenciaConflitanteError, LimiteExcedidoError,
  PrazoCancelamentoError, SlotIndisponivelError, TipoInexistenteError,
} from '@/lib/agendamento/servico';
import { DataInvalidaError } from '@/lib/datetime';

describe('erro()', () => {
  it('sempre marca a resposta como não cacheável, mesmo com headers extras', async () => {
    const r = erro(409, { erro: 'SLOT_INDISPONIVEL', mensagem: 'x' }, { 'Retry-After': '5' });
    expect(r.status).toBe(409);
    expect(r.headers.get('Cache-Control')).toBe(SEM_CACHE['Cache-Control']);
    expect(r.headers.get('Retry-After')).toBe('5');
    expect(await r.json()).toEqual({ erro: 'SLOT_INDISPONIVEL', mensagem: 'x' });
  });
});

describe('traduzirErro()', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    [new SlotIndisponivelError(), 409, 'SLOT_INDISPONIVEL'],
    [new TipoInexistenteError(), 404, 'TIPO_INEXISTENTE'],
    [new AgendamentoInexistenteError(), 404, 'NAO_ENCONTRADO'],
    [new IdempotenciaConflitanteError(), 422, 'IDEMPOTENCIA'],
    [new PrazoCancelamentoError(24), 409, 'LIMITE'],
    [new DataInvalidaError('fora do alcance'), 422, 'VALIDACAO'],
  ] as const)('%#. %s → status e código certos', async (excecao, status, codigo) => {
    const r = traduzirErro(excecao);
    expect(r.status).toBe(status);
    const corpo = await r.json();
    expect(corpo.erro).toBe(codigo);
    // A mensagem do domínio pode ir (não é PII), mas nunca stack/nome interno.
    expect(corpo).not.toHaveProperty('stack');
  });

  it('LimiteExcedidoError → 429 com Retry-After', async () => {
    const r = traduzirErro(new LimiteExcedidoError('Muitos agendamentos.'));
    expect(r.status).toBe(429);
    expect(r.headers.get('Retry-After')).toBe('600');
    expect((await r.json())).toEqual({ erro: 'LIMITE', mensagem: 'Muitos agendamentos.' });
  });

  it('erro desconhecido (banco fora, bug) → 500 genérico, SEM vazar a mensagem interna', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const interno = new Error('senha do banco: hunter2, paciente ana@exemplo.com');
    const r = traduzirErro(interno);
    expect(r.status).toBe(500);
    const corpo = await r.json();
    expect(corpo.erro).toBe('INTERNO');
    expect(corpo.mensagem).not.toContain('hunter2');
    expect(corpo.mensagem).not.toContain('ana@exemplo.com');
    expect(JSON.stringify(corpo)).not.toContain('hunter2');
  });

  it('valor lançado que não é um Error (string, objeto) também vira 500 genérico', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r1 = traduzirErro('algo quebrou');
    expect(r1.status).toBe(500);
    expect((await r1.json()).erro).toBe('INTERNO');

    const r2 = traduzirErro({ codigoInterno: 'X', paciente: { email: 'ana@exemplo.com' } });
    expect(r2.status).toBe(500);
    const corpo2 = await r2.json();
    expect(JSON.stringify(corpo2)).not.toContain('ana@exemplo.com');
  });

  it('resposta de erro nunca é cacheada', () => {
    const r = traduzirErro(new SlotIndisponivelError());
    expect(r.headers.get('Cache-Control')).toBe('private, no-store');
  });
});
