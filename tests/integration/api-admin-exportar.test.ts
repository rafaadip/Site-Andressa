/**
 * GET /admin/exportar contra Postgres REAL (FASE-09/10, LGPD Art. 18 V).
 * `next/headers` é mockado: fora de um Route Handler de verdade não há
 * cookie jar de requisição (ver tests/unit/auth-admin.test.ts).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sqlCliente } from '@/lib/db';
import { _limparCacheEnv } from '@/lib/env';
import { criarSessao, nomeCookieSessao } from '@/lib/auth/sessao';
import { criarAgendamento, disponibilidade } from '@/lib/agendamento/servico';
import { dataLocal } from '@/lib/datetime';
import { somarDias } from '@/lib/datetime-cliente';
import { limparBanco } from '../setup/fabrica';

const cookiesMock = vi.fn();
vi.mock('next/headers', () => ({ cookies: () => cookiesMock() }));

const { GET } = await import('@/app/admin/exportar/route');

const d = process.env.DATABASE_URL_TEST ? describe : describe.skip;
const AUTH_SECRET = 'segredo-de-sessao-de-teste-com-32-caracteres-ou-mais';
const ADMIN_EMAIL = 'dra@exemplo.com';

function jarCom(valor: string | undefined) {
  cookiesMock.mockResolvedValue({ get: (nome: string) => (nome === nomeCookieSessao() && valor ? { value: valor } : undefined) });
}

d('GET /admin/exportar', () => {
  const sql = () => sqlCliente();
  beforeEach(async () => {
    await limparBanco(sql());
    vi.stubEnv('AUTH_SECRET', AUTH_SECRET);
    vi.stubEnv('ADMIN_EMAIL', ADMIN_EMAIL);
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://localhost:3100');
    _limparCacheEnv();
  });
  afterEach(() => { vi.unstubAllEnvs(); _limparCacheEnv(); });

  const req = (qs: string) => new Request(`http://localhost/admin/exportar?${qs}`);

  it('sem sessão (sem cookie) → 401', async () => {
    jarCom(undefined);
    const r = await GET(req('email=ana@exemplo.com'));
    expect(r.status).toBe(401);
  });

  it('cookie de sessão adulterado/inválido → 401', async () => {
    jarCom('lixo.assinado-errado');
    const r = await GET(req('email=ana@exemplo.com'));
    expect(r.status).toBe(401);
  });

  it('com sessão válida mas SEM e-mail informado → 422', async () => {
    jarCom(criarSessao(ADMIN_EMAIL));
    const r = await GET(req(''));
    expect(r.status).toBe(422);
  });

  it('com sessão válida e e-mail: exporta em JSON, sem PII no cabeçalho e não cacheável', async () => {
    jarCom(criarSessao(ADMIN_EMAIL));
    const hoje = dataLocal(new Date());
    const email = `titular.${randomUUID().slice(0, 8)}@exemplo.com`;
    const slot = (await disponibilidade({ tipo: 'consulta-presencial', de: hoje, ate: somarDias(hoje, 13) })).dias.flatMap((d) => d.slots)[0]!;
    await criarAgendamento({
      tipo: 'consulta-presencial', inicio: slot.inicio,
      paciente: { nome: 'Ana Titular', telefone: '+5511912345678', email, motivo: '', consentimentoDados: true, consentimentoSaude: false },
    }, { ip: '203.0.113.9', idempotencyKey: randomUUID() });

    const r = await GET(req(`email=${encodeURIComponent(email)}`));
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toContain('application/json');
    expect(r.headers.get('Cache-Control')).toBe('private, no-store');
    expect(r.headers.get('X-Robots-Tag')).toBe('noindex');
    const dados = await r.json();
    expect(dados.titular).toBe(email);
    expect(dados.consultas).toHaveLength(1);
  });

  it('formato csv: cabeçalho text/csv', async () => {
    jarCom(criarSessao(ADMIN_EMAIL));
    const r = await GET(req('email=ninguem@exemplo.com&formato=csv'));
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toContain('text/csv');
  });
});
