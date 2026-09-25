/**
 * GET /api/ics?t=<token> contra Postgres REAL (FASE-06/13).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sqlCliente } from '@/lib/db';
import { dataLocal } from '@/lib/datetime';
import { somarDias } from '@/lib/datetime-cliente';
import { criarAgendamento, cancelarPorToken, disponibilidade } from '@/lib/agendamento/servico';
import { limparBanco } from '../setup/fabrica';

vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: vi.fn() }));

const { GET } = await import('@/app/api/ics/route');

const d = process.env.DATABASE_URL_TEST ? describe : describe.skip;

d('GET /api/ics', () => {
  const sql = () => sqlCliente();
  beforeEach(async () => { await limparBanco(sql()); });
  afterAll(async () => { await limparBanco(sql()); });

  async function criar() {
    const hoje = dataLocal(new Date());
    const r = await disponibilidade({ tipo: 'consulta-presencial', de: hoje, ate: somarDias(hoje, 13) });
    const slot = r.dias.flatMap((x) => x.slots)[0]!;
    const c = await criarAgendamento({
      tipo: 'consulta-presencial', inicio: slot.inicio,
      paciente: {
        nome: 'Ana Souza', telefone: '+5511912345678', email: `ana.${randomUUID().slice(0, 8)}@exemplo.com`,
        motivo: '', consentimentoDados: true, consentimentoSaude: false,
      },
    }, { ip: '203.0.113.5', idempotencyKey: randomUUID() });
    return { token: c.agendamento.urlGestao.split('/').pop()!, agendamento: c.agendamento };
  }
  const req = (t: string) => new Request(`http://localhost/api/ics?t=${encodeURIComponent(t)}`);

  it('token ausente → 404', async () => {
    const r = await GET(new Request('http://localhost/api/ics'));
    expect(r.status).toBe(404);
  });

  it('token inválido/inexistente → 404', async () => {
    const r = await GET(req('x'.repeat(43)));
    expect(r.status).toBe(404);
  });

  it('token malicioso (injeção) → 404, não 500', async () => {
    const r = await GET(req("'; DROP TABLE appointment; --"));
    expect(r.status).toBe(404);
  });

  it('token válido → text/calendar com UID estável e SEQUENCE:0 (REQUEST)', async () => {
    const { token } = await criar();
    const r = await GET(req(token));
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8; method=REQUEST');
    expect(r.headers.get('Content-Disposition')).toContain('.ics');
    expect(r.headers.get('Cache-Control')).toBe('private, no-store');
    expect(r.headers.get('X-Robots-Tag')).toBe('noindex');
    const texto = await r.text();
    expect(texto).toContain('METHOD:REQUEST');
    expect(texto).toContain('SEQUENCE:0');
    expect(texto).toMatch(/^UID:.+$/m);
  });

  it('depois de cancelado → CANCEL, MESMO UID, SEQUENCE incrementado', async () => {
    const { token } = await criar();
    const antes = await (await GET(req(token))).text();
    const uidDe = (ics: string) => ics.match(/^UID:(.+)$/m)?.[1];

    await cancelarPorToken(token);
    const r = await GET(req(token));
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toContain('method=CANCEL');
    const depois = await r.text();
    expect(depois).toContain('METHOD:CANCEL');
    expect(depois).toContain('SEQUENCE:1');
    expect(uidDe(depois)).toBe(uidDe(antes));
  });
});
