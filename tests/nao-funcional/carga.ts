/**
 * Teste de CARGA e LATÊNCIA (não funcional) contra o build de produção.
 *
 *   npm run build && DATABASE_URL_TEST=… npm run test:carga
 *
 * Volume de referência (00-ARQUITETURA §1): 5–40 agendamentos/semana. O
 * cenário abaixo é ordens de grandeza acima disso — o pico de quando o
 * link é postado no Instagram — e mede o que o paciente sente.
 *
 * Orçamentos (servidor local; em produção há rede, mas a função fica na
 * mesma região do banco):
 *   páginas                         p95 ≤ 800 ms, 0 erro
 *   GET /api/disponibilidade (14d)  p95 ≤ 800 ms, 0 erro
 *   POST concorrente no MESMO slot  exatamente 1× 201, resto 409, p95 ≤ 2 s
 *   POSTs em slots distintos        0 erro 5xx
 */
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { carga, derrubar, medir, relatar, resumo, subirServidor, type Orcamento } from './util';
import { semear } from '../../scripts/seed';
import { execFileSync } from 'node:child_process';

const DB = process.env.DATABASE_URL_TEST;
const PORTA = 3401;
const BASE = `http://localhost:${PORTA}`;

async function main() {
  if (!DB) { console.log('Sem DATABASE_URL_TEST — teste de carga pulado.'); return; }
  execFileSync('npx', ['tsx', 'scripts/migrate.ts'], { env: { ...process.env, DATABASE_URL: DB, DATABASE_URL_UNPOOLED: DB }, stdio: 'pipe' });
  await semear(DB);
  const sql = postgres(DB, { max: 1, onnotice: () => {} });
  await sql`DELETE FROM notification`; await sql`DELETE FROM audit_log`; await sql`DELETE FROM appointment`;

  const srv = await subirServidor(PORTA, {
    DATABASE_URL: DB, TOKEN_SALT: 'sal-de-carga-com-16-caracteres', NEXT_PUBLIC_SITE_URL: BASE, AGENDAMENTO_SEM_GOOGLE: 'aceito',
  });
  const orcamentos: Orcamento[] = [];
  const dados: Record<string, unknown> = {};
  try {
    // Aquecimento (JIT, pool de conexões) — não entra na medida.
    await carga(20, 5, () => medir(`${BASE}/`));

    const paginas = await carga(300, 20, (i) => medir(`${BASE}${['/', '/agendar', '/sobre'][i % 3]}`));
    const rp = resumo('páginas (/, /agendar, /sobre) — 300 req, 20 simultâneas', paginas);
    orcamentos.push({ nome: 'páginas p95 ≤ 800 ms e 0 erro', ok: rp.p95 <= 800 && paginas.every((m) => m.status === 200), detalhe: `p95 ${rp.p95} ms, status ${JSON.stringify(rp.status)}` });

    const hoje = new Date().toISOString().slice(0, 10);
    const ate = new Date(Date.now() + 13 * 86_400_000).toISOString().slice(0, 10);
    const disp = await carga(300, 20, () => medir(`${BASE}/api/disponibilidade?tipo=consulta-presencial&de=${hoje}&ate=${ate}`));
    const rd = resumo('GET /api/disponibilidade (14 dias) — 300 req, 20 simultâneas', disp);
    orcamentos.push({ nome: 'disponibilidade p95 ≤ 800 ms e 0 erro', ok: rd.p95 <= 800 && disp.every((m) => m.status === 200), detalhe: `p95 ${rd.p95} ms, status ${JSON.stringify(rd.status)}` });

    const slots = (await (await fetch(`${BASE}/api/disponibilidade?tipo=consulta-presencial&de=${hoje}&ate=${ate}`)).json())
      .dias.flatMap((d: { slots: { inicio: string }[] }) => d.slots) as { inicio: string }[];
    const post = (inicio: string, i: number) => medir(`${BASE}/api/agendamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), 'x-forwarded-for': `10.200.${i % 250}.${Math.floor(i / 250)}` },
      body: JSON.stringify({ tipo: 'consulta-presencial', inicio, site: '', paciente: {
        nome: 'Carga Teste', telefone: '11987654321', email: `carga.${randomUUID().slice(0, 8)}@exemplo.com`, consentimentoDados: true,
      } }),
    });

    // Pico no MESMO horário: a trava do banco precisa deixar exatamente 1.
    const mesmo = await carga(40, 40, (i) => post(slots[0]!.inicio, i));
    const rm = resumo('POST /api/agendamentos — 40 simultâneos no MESMO horário', mesmo);
    const criados = mesmo.filter((m) => m.status === 201).length;
    const recusados = mesmo.filter((m) => m.status === 409).length;
    orcamentos.push({ nome: 'mesmo horário: 1× 201 e 39× 409', ok: criados === 1 && recusados === 39, detalhe: `201=${criados} 409=${recusados}` });
    orcamentos.push({ nome: 'mesmo horário p95 ≤ 2000 ms', ok: rm.p95 <= 2000, detalhe: `p95 ${rm.p95} ms` });

    // Horários distintos em paralelo: ninguém recebe 5xx.
    const distintos = await carga(Math.min(20, slots.length - 1), 10, (i) => post(slots[i + 1]!.inicio, 1000 + i));
    const rdist = resumo('POST /api/agendamentos — 20 horários distintos, 10 simultâneos', distintos);
    orcamentos.push({ nome: 'horários distintos: 0 erro 5xx', ok: distintos.every((m) => m.status < 500 && m.status !== 0), detalhe: `status ${JSON.stringify(rdist.status)}` });

    const [{ n }] = await sql`SELECT count(*)::int AS n FROM appointment` as [{ n: number }];
    const [{ sobrepostos }] = await sql`
      SELECT count(*)::int AS sobrepostos FROM appointment a JOIN appointment b
        ON a.id < b.id AND a.status IN ('held','confirmed') AND b.status IN ('held','confirmed')
       AND tstzrange(a.starts_at, a.ends_at) && tstzrange(b.starts_at, b.ends_at)` as [{ sobrepostos: number }];
    orcamentos.push({ nome: 'zero sobreposição no banco depois da carga', ok: sobrepostos === 0, detalhe: `${n} consultas, ${sobrepostos} sobrepostas` });

    Object.assign(dados, { paginas: rp, disponibilidade: rd, mesmoHorario: rm, distintos: rdist });
  } finally {
    derrubar(srv);
    await sql`DELETE FROM notification`; await sql`DELETE FROM audit_log`; await sql`DELETE FROM appointment`;
    await sql.end();
  }
  relatar(orcamentos, dados);
}

main().catch((e) => { console.error(e); process.exit(1); });
