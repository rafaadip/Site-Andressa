/**
 * Retenção LGPD (FASE-10 §3.5) com o relógio adiantado — critério de
 * aceite: "motivo apagado automaticamente após 90 dias".
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { sqlCliente } from '@/lib/db';
import { aplicarRetencao } from '@/lib/lgpd/retencao';
import { buscarPorToken } from '@/lib/agendamento/servico';
import { inserirConsulta, limparBanco } from '../setup/fabrica';

const d = process.env.DATABASE_URL_TEST ? describe : describe.skip;
const DIA = 86_400_000;

d('retenção de dados (LGPD)', () => {
  const sql = () => sqlCliente();
  beforeEach(async () => { await limparBanco(sql()); });
  afterAll(async () => { await limparBanco(sql()); });

  it('apaga o motivo 90 dias após a consulta — não antes', async () => {
    const inicio = new Date(Date.now() - 10 * DIA);
    const { id } = await inserirConsulta(sql(), { inicio, motivo: 'Dor de cabeça' });

    expect((await aplicarRetencao(new Date(Date.now() + 70 * DIA))).motivosApagados).toBe(0);
    const r = await aplicarRetencao(new Date(Date.now() + 81 * DIA));
    expect(r.motivosApagados).toBe(1);
    const [l] = await sql()`SELECT patient_note, consent_health_at, patient_name FROM appointment WHERE id = ${id}`;
    expect(l).toMatchObject({ patient_note: null, consent_health_at: null, patient_name: 'Bia Lima' });
  });

  it('anonimiza o contato após 5 anos e invalida o link de gestão', async () => {
    const { id, token } = await inserirConsulta(sql(), { inicio: new Date(Date.now() - 2 * DIA) });
    expect(await buscarPorToken(token)).not.toBeNull();
    const r = await aplicarRetencao(new Date(Date.now() + 5 * 366 * DIA));
    expect(r.contatosAnonimizados).toBe(1);
    const [l] = await sql()`SELECT patient_name, patient_email, patient_phone, anonymized_at FROM appointment WHERE id = ${id}`;
    expect(l).toMatchObject({ patient_name: 'Titular removido', patient_email: '', patient_phone: '' });
    expect(l!.anonymized_at).not.toBeNull();
    expect(await buscarPorToken(token)).toBeNull();
  });

  it('registra o que apagou (contagens), e rodar de novo não apaga nada', async () => {
    await inserirConsulta(sql(), { inicio: new Date(Date.now() - 100 * DIA), motivo: 'Exames' });
    await aplicarRetencao();
    expect(await aplicarRetencao()).toMatchObject({ motivosApagados: 0, contatosAnonimizados: 0 });
    const trilha = await sql()`SELECT meta FROM audit_log WHERE action = 'data.retention' ORDER BY at`;
    expect(trilha).toHaveLength(2);
    expect(trilha[0]!.meta).toMatchObject({ motivosApagados: 1 });
    expect(JSON.stringify(trilha)).not.toContain('Exames');
  });
});
