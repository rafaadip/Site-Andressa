/**
 * POST /api/agendamentos contra Postgres REAL (FASE-07/13) — chama o handler
 * exportado diretamente, com `Request` de verdade. `after()` é mockado: o
 * efeito (Google/e-mail) roda fora da requisição e não é o que se testa aqui
 * (ver tests/integration/notificacoes.test.ts e google.test.ts).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sqlCliente } from '@/lib/db';
import { dataLocal } from '@/lib/datetime';
import { somarDias } from '@/lib/datetime-cliente';
import { disponibilidade, LIMITES } from '@/lib/agendamento/servico';
import { limparBanco } from '../setup/fabrica';

vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: vi.fn() }));

const { POST } = await import('@/app/api/agendamentos/route');

const d = process.env.DATABASE_URL_TEST ? describe : describe.skip;

d('POST /api/agendamentos', () => {
  const sql = () => sqlCliente();
  beforeEach(async () => { await limparBanco(sql()); });
  afterAll(async () => { await limparBanco(sql()); });

  async function slotsLivres() {
    const hoje = dataLocal(new Date());
    const r = await disponibilidade({ tipo: 'consulta-presencial', de: hoje, ate: somarDias(hoje, 13) });
    return r.dias.flatMap((x) => x.slots);
  }

  function paciente(extra: Partial<Record<string, unknown>> = {}) {
    return {
      nome: 'Ana Souza', telefone: '+5511912345678', email: `ana.${randomUUID().slice(0, 8)}@exemplo.com`,
      motivo: '', consentimentoDados: true, consentimentoSaude: false, ...extra,
    };
  }
  function corpo(inicio: string, extra: Partial<Record<string, unknown>> = {}) {
    return { tipo: 'consulta-presencial', inicio, paciente: paciente(), ...extra };
  }
  function req(body: unknown, headers: Record<string, string> = {}) {
    const texto = typeof body === 'string' ? body : JSON.stringify(body);
    return new Request('http://localhost/api/agendamentos', {
      method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: texto,
    });
  }
  const chave = () => randomUUID();

  it('sem Idempotency-Key → 400', async () => {
    const [slot] = await slotsLivres();
    const r = await POST(req(corpo(slot!.inicio)));
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe('VALIDACAO');
  });

  it('Idempotency-Key mal formada (não é UUID) → 400', async () => {
    const [slot] = await slotsLivres();
    const r = await POST(req(corpo(slot!.inicio), { 'idempotency-key': 'não-é-um-uuid' }));
    expect(r.status).toBe(400);
  });

  it('corpo maior que 8 KB → 413', async () => {
    const gigante = corpo(new Date().toISOString(), { paciente: paciente({ motivo: 'x'.repeat(9000) }) });
    const r = await POST(req(gigante, { 'idempotency-key': chave() }));
    expect(r.status).toBe(413);
  });

  it('JSON inválido → 400', async () => {
    const r = await POST(req('{ isto não é json', { 'idempotency-key': chave() }));
    expect(r.status).toBe(400);
    expect((await r.json()).erro).toBe('VALIDACAO');
  });

  it('campos inválidos → 422 com o mapa `campos`', async () => {
    const [slot] = await slotsLivres();
    const r = await POST(req(corpo(slot!.inicio, { paciente: paciente({ nome: 'A', telefone: '123', email: 'não-é-email' }) }),
      { 'idempotency-key': chave() }));
    expect(r.status).toBe(422);
    const corpoResp = await r.json();
    expect(corpoResp.erro).toBe('VALIDACAO');
    expect(corpoResp.campos).toBeTypeOf('object');
    expect(Object.keys(corpoResp.campos).length).toBeGreaterThan(0);
  });

  it('honeypot preenchido (campo "site") → 422', async () => {
    const [slot] = await slotsLivres();
    const r = await POST(req(corpo(slot!.inicio, { site: 'http://spam.example' }), { 'idempotency-key': chave() }));
    expect(r.status).toBe(422);
  });

  it('sucesso → 201 com o link de gestão, e o horário some da oferta', async () => {
    const [slot] = await slotsLivres();
    const r = await POST(req(corpo(slot!.inicio), { 'idempotency-key': chave() }));
    expect(r.status).toBe(201);
    const ag = await r.json();
    expect(ag.urlGestao).toMatch(/\/consulta\/[A-Za-z0-9_-]{43}$/);
    expect(ag.inicio).toBe(slot!.inicio);
    expect(r.headers.get('Cache-Control')).toBe('private, no-store');

    const restantes = await slotsLivres();
    expect(restantes.some((s) => s.inicio === slot!.inicio)).toBe(false);
  });

  it('mesma Idempotency-Key repetida → 200 com o MESMO link (não cria de novo)', async () => {
    const [slot] = await slotsLivres();
    const k = chave();
    const c = corpo(slot!.inicio);
    const a = await POST(req(c, { 'idempotency-key': k }));
    const b = await POST(req(c, { 'idempotency-key': k }));
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    const [ag1, ag2] = await Promise.all([a.json(), b.json()]);
    expect(ag2.urlGestao).toBe(ag1.urlGestao);
    const [{ n }] = await sql()`SELECT count(*)::int AS n FROM appointment` as [{ n: number }];
    expect(n).toBe(1);
  });

  it('mesma Idempotency-Key com horário DIFERENTE (mesmo paciente) → 422 (idempotência conflitante)', async () => {
    const [s1, s2] = await slotsLivres();
    const k = chave();
    const email = `ana.${randomUUID().slice(0, 8)}@exemplo.com`;
    await POST(req(corpo(s1!.inicio, { paciente: paciente({ email }) }), { 'idempotency-key': k }));
    const r = await POST(req(corpo(s2!.inicio, { paciente: paciente({ email }) }), { 'idempotency-key': k }));
    expect(r.status).toBe(422);
    expect((await r.json()).erro).toBe('IDEMPOTENCIA');
  });

  it('horário já ocupado → 409', async () => {
    const [slot] = await slotsLivres();
    await POST(req(corpo(slot!.inicio), { 'idempotency-key': chave() }));
    const r = await POST(req(corpo(slot!.inicio), { 'idempotency-key': chave() }));
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toBe('SLOT_INDISPONIVEL');
  });

  it(`acima do limite (${LIMITES.porIpPorHora}/hora do mesmo IP) → 429 com Retry-After`, async () => {
    const slots = await slotsLivres();
    const ip = '203.0.113.42';
    for (let i = 0; i < LIMITES.porIpPorHora; i++) {
      const r = await POST(req(corpo(slots[i]!.inicio), { 'idempotency-key': chave(), 'x-forwarded-for': ip }));
      expect(r.status).toBe(201);
    }
    const r = await POST(req(corpo(slots[LIMITES.porIpPorHora]!.inicio), { 'idempotency-key': chave(), 'x-forwarded-for': ip }));
    expect(r.status).toBe(429);
    expect(r.headers.get('Retry-After')).toBe('600');
    expect((await r.json()).erro).toBe('LIMITE');
  });
});
