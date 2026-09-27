/**
 * POST /api/contatos contra Postgres REAL: validação no servidor, gravação,
 * limites sob lock, campo-isca, retenção de 90 dias e direitos do titular.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { sqlCliente } from '@/lib/db';
import { aplicarRetencao } from '@/lib/lgpd/retencao';
import { anonimizarTitular, exportarTitular, paraCsv } from '@/lib/agendamento/admin';
import {
  apagarContato, contarPendentes, ContatoInexistenteError, LIMITES_CONTATO_ABUSO, listarContatos, marcarContatoAtendido,
} from '@/lib/contatos/servico';
import { VERSAO_CONSENTIMENTO_CONTATO } from '@/lib/validation/contato';
import { limparBanco } from '../setup/fabrica';

const { POST } = await import('@/app/api/contatos/route');

const d = process.env.DATABASE_URL_TEST ? describe : describe.skip;
const DIA = 86_400_000;

d('POST /api/contatos', () => {
  const sql = () => sqlCliente();
  beforeEach(async () => { await limparBanco(sql()); });
  afterAll(async () => { await limparBanco(sql()); });

  let ipSeq = 0;
  const corpo = (extra: Record<string, unknown> = {}) => ({
    nome: 'Maria', sobrenome: 'da Silva', email: 'Maria@Exemplo.com', telefone: '11912345678',
    idade: '34', horario: 'tarde', motivo: 'emagrecimento', consentimento: true, site: '', ...extra,
  });
  function req(body: unknown, headers: Record<string, string> = {}) {
    return new Request('http://localhost/api/contatos', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${++ipSeq % 250}`, ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }
  const linhas = () => sql()`SELECT * FROM contact_request ORDER BY created_at`;

  it('válido → 201, grava normalizado e não devolve dado do paciente', async () => {
    const r = await POST(req(corpo()));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ ok: true });
    const [l] = await linhas();
    expect(l).toMatchObject({
      first_name: 'Maria', last_name: 'da Silva', email: 'maria@exemplo.com', phone: '(11) 91234-5678',
      age: 34, preferred_period: 'tarde', reason: 'emagrecimento', consent_version: VERSAO_CONSENTIMENTO_CONTATO,
      handled_at: null,
    });
    expect(l!.consent_ip_hash).toMatch(/^[0-9a-f]{64}$/);   // hash, nunca o IP
  });

  it('opcionais vazios viram NULL', async () => {
    expect((await POST(req(corpo({ telefone: '', horario: '' })))).status).toBe(201);
    const [l] = await linhas();
    expect(l).toMatchObject({ phone: null, preferred_period: null });
  });

  it('sem consentimento → 422 e nada gravado', async () => {
    const r = await POST(req(corpo({ consentimento: false })));
    expect(r.status).toBe(422);
    expect((await r.json()).campos.consentimento).toBeTruthy();
    expect(await linhas()).toHaveLength(0);
  });

  it.each([
    ['nome com SQLi', { nome: "x'); DROP TABLE contact_request;--" }],
    ['e-mail com aspas', { email: '"a"@exemplo.com' }],
    ['motivo fora da lista', { motivo: "emagrecimento' OR '1'='1" }],
    ['horário fora da lista', { horario: 'madrugada' }],
    ['idade fora do limite', { idade: '200' }],
    ['idade como número JSON', { idade: 34 }],
    ['telefone inválido', { telefone: '(00) 1234' }],
    ['campo extra de outro tipo', { nome: ['Maria'] }],
  ])('%s → 422 e nada gravado', async (_, extra) => {
    const r = await POST(req(corpo(extra)));
    expect(r.status).toBe(422);
    expect(await linhas()).toHaveLength(0);
  });

  it('a tabela continua de pé depois das tentativas de injeção', async () => {
    await POST(req(corpo({ nome: "x'); DROP TABLE contact_request;--" })));
    expect((await POST(req(corpo()))).status).toBe(201);
    expect(await linhas()).toHaveLength(1);
  });

  it('Content-Type que não é JSON → 415; JSON quebrado → 400; corpo grande → 413', async () => {
    expect((await POST(req(corpo(), { 'content-type': 'text/plain' }))).status).toBe(415);
    expect((await POST(req('{ nao é json'))).status).toBe(400);
    expect((await POST(req(JSON.stringify({ ...corpo(), lixo: 'x'.repeat(5000) })))).status).toBe(413);
    expect(await linhas()).toHaveLength(0);
  });

  it('campo-isca preenchido: responde 201 (não ensina o robô) e NÃO grava', async () => {
    const r = await POST(req(corpo({ site: 'http://spam.exemplo' })));
    expect(r.status).toBe(201);
    expect(await linhas()).toHaveLength(0);
  });

  it(`limite por origem: o ${LIMITES_CONTATO_ABUSO.porIpPorHora + 1}º pedido do mesmo IP na hora → 429`, async () => {
    const ip = { 'x-forwarded-for': '198.51.100.7' };
    for (let i = 0; i < LIMITES_CONTATO_ABUSO.porIpPorHora; i++) {
      expect((await POST(req(corpo(), ip))).status).toBe(201);
    }
    const r = await POST(req(corpo(), ip));
    expect(r.status).toBe(429);
    expect(await linhas()).toHaveLength(LIMITES_CONTATO_ABUSO.porIpPorHora);
  });

  it('limite contado SOB lock: rajada simultânea do mesmo IP não passa do teto', async () => {
    const ip = { 'x-forwarded-for': '198.51.100.9' };
    const respostas = await Promise.all(Array.from({ length: 8 }, () => POST(req(corpo(), ip))));
    expect(respostas.filter((r) => r.status === 201)).toHaveLength(LIMITES_CONTATO_ABUSO.porIpPorHora);
    expect(respostas.filter((r) => r.status === 429)).toHaveLength(8 - LIMITES_CONTATO_ABUSO.porIpPorHora);
  });
});

d('contatos no painel e LGPD', () => {
  const sql = () => sqlCliente();
  beforeEach(async () => { await limparBanco(sql()); });
  afterAll(async () => { await limparBanco(sql()); });

  async function inserir(email: string, criadoEm = new Date()) {
    const [p] = await sql()`SELECT id FROM practitioner LIMIT 1`;
    const [l] = await sql()`
      INSERT INTO contact_request (practitioner_id, first_name, last_name, email, age, reason, consent_at, consent_version, consent_ip_hash, created_at)
      VALUES (${p!.id}, 'Ana', 'Lima', ${email}, 40, 'performance', ${criadoEm.toISOString()}, 'v', 'h', ${criadoEm.toISOString()})
      RETURNING id`;
    return l!.id as string;
  }

  it('pendentes x retornados; marcar e desmarcar deixa trilha na auditoria', async () => {
    const id = await inserir('ana@exemplo.com');
    expect(await contarPendentes()).toBe(1);
    await marcarContatoAtendido(id, true);
    expect(await listarContatos({ pendentes: true })).toHaveLength(0);
    expect(await listarContatos()).toHaveLength(1);
    await marcarContatoAtendido(id, false);
    expect(await contarPendentes()).toBe(1);
    const acoes = await sql()`SELECT action FROM audit_log WHERE subject_id = ${id} ORDER BY at`;
    expect(acoes.map((a) => a.action)).toEqual(['contact.handled', 'contact.reopened']);
  });

  it('apagar remove a linha; id inválido ou inexistente → erro de domínio', async () => {
    const id = await inserir('ana@exemplo.com');
    await apagarContato(id);
    expect(await listarContatos()).toHaveLength(0);
    await expect(apagarContato(id)).rejects.toBeInstanceOf(ContatoInexistenteError);
    await expect(marcarContatoAtendido("1' OR '1'='1", true)).rejects.toBeInstanceOf(ContatoInexistenteError);
  });

  it('retenção: apaga o pedido inteiro 90 dias depois de chegar — não antes', async () => {
    await inserir('ana@exemplo.com', new Date(Date.now() - 10 * DIA));
    expect((await aplicarRetencao(new Date(Date.now() + 70 * DIA))).pedidosContatoApagados).toBe(0);
    expect((await aplicarRetencao(new Date(Date.now() + 81 * DIA))).pedidosContatoApagados).toBe(1);
    expect(await listarContatos()).toHaveLength(0);
  });

  it('titular: exportação traz os pedidos (JSON e CSV) e a eliminação os apaga', async () => {
    await inserir('ana@exemplo.com');
    await inserir('outra@exemplo.com');
    const dados = await exportarTitular('ANA@exemplo.com');
    expect(dados.contatos).toEqual([expect.objectContaining({ nome: 'Ana', motivo: 'Performance esportiva', idade: 40 })]);
    expect(paraCsv(dados)).toContain('"Performance esportiva"');

    const r = await anonimizarTitular('ana@exemplo.com');
    expect(r.contatos).toBe(1);
    const restantes = await listarContatos();
    expect(restantes.map((c) => c.email)).toEqual(['outra@exemplo.com']);
  });
});
