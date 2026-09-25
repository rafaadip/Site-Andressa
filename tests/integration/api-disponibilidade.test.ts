/**
 * GET /api/disponibilidade contra Postgres REAL (FASE-04/13).
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { sqlCliente } from '@/lib/db';
import { dataLocal } from '@/lib/datetime';
import { somarDias } from '@/lib/datetime-cliente';
import { limparBanco } from '../setup/fabrica';

const { GET } = await import('@/app/api/disponibilidade/route');

const d = process.env.DATABASE_URL_TEST ? describe : describe.skip;

d('GET /api/disponibilidade', () => {
  const sql = () => sqlCliente();
  beforeEach(async () => { await limparBanco(sql()); });
  afterAll(async () => { await limparBanco(sql()); });

  const hoje = () => dataLocal(new Date());
  const url = (qs: string) => new Request(`http://localhost/api/disponibilidade?${qs}`);

  it('sem parâmetro "tipo" → 422 sem stack', async () => {
    const r = await GET(url(''));
    expect(r.status).toBe(422);
    const corpo = await r.json();
    expect(corpo.erro).toBe('VALIDACAO');
    expect(corpo).not.toHaveProperty('stack');
  });

  it('tipo em formato inválido (maiúsculas, espaço) → 422', async () => {
    const r = await GET(url('tipo=Consulta Presencial'));
    expect(r.status).toBe(422);
  });

  it('data "de" mal formada → 422', async () => {
    const r = await GET(url('tipo=consulta-presencial&de=15-09-2026'));
    expect(r.status).toBe(422);
  });

  it('tipo inexistente → 404 (não 500)', async () => {
    const r = await GET(url('tipo=nao-existe'));
    expect(r.status).toBe(404);
    expect((await r.json()).erro).toBe('TIPO_INEXISTENTE');
  });

  it('data inicial já passou → 422', async () => {
    const r = await GET(url(`tipo=consulta-presencial&de=2020-01-01&ate=2020-01-02`));
    expect(r.status).toBe(422);
  });

  it('janela maior que 31 dias → 4xx sem 500/stack', async () => {
    const de = hoje();
    const r = await GET(url(`tipo=consulta-presencial&de=${de}&ate=${somarDias(de, 45)}`));
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
    const corpo = await r.json();
    expect(corpo).not.toHaveProperty('stack');
  });

  it('ano 9999 (fora do alcance) → 4xx, nunca 500', async () => {
    const r = await GET(url('tipo=consulta-presencial&de=9999-01-01&ate=9999-01-02'));
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
  });

  it('data "ate" antes de "de" (janela invertida) → 4xx, nunca 500', async () => {
    const de = hoje();
    const r = await GET(url(`tipo=consulta-presencial&de=${de}&ate=${somarDias(de, -5)}`));
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
  });

  it('pedido válido → 200 com dias/slots e Cache-Control coerente (nunca cacheável)', async () => {
    const de = hoje();
    const r = await GET(url(`tipo=consulta-presencial&de=${de}&ate=${somarDias(de, 6)}`));
    expect(r.status).toBe(200);
    expect(r.headers.get('Cache-Control')).toBe('private, no-store');
    const corpo = await r.json();
    expect(corpo.tipo.slug).toBe('consulta-presencial');
    expect(Array.isArray(corpo.dias)).toBe(true);
    expect(corpo.dias.some((dia: { slots: unknown[] }) => dia.slots.length > 0)).toBe(true);
  });

  it('sem "de"/"ate": usa hoje como padrão (não lança)', async () => {
    const r = await GET(url('tipo=consulta-presencial'));
    expect(r.status).toBe(200);
  });
});
