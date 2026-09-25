/**
 * Teste de RESILIÊNCIA (não funcional) — o site com o banco fora do ar.
 *
 *   npm run build && npm run test:resiliencia
 *
 * Dois modos de falha, porque se comportam diferente:
 *   recusado     → porta fechada: erro imediato;
 *   buraco negro → aceita a conexão e nunca responde: o pior caso, é o
 *                  que pendura função serverless até o timeout.
 *
 * Esperado (ADR-002 e FASE-13): páginas institucionais continuam no ar e
 * rápidas; /agendar cai no WhatsApp; APIs respondem erro GENÉRICO (sem
 * stack, sem SQL); /api/health diz 503.
 */
import net from 'node:net';
import { derrubar, medir, relatar, subirServidor, type Orcamento } from './util';

const ENV_BASE = { TOKEN_SALT: 'sal-de-resiliencia-16-caracteres', AGENDAMENTO_SEM_GOOGLE: 'aceito' };

async function cenario(nome: string, porta: number, dbUrl: string, limites: { pagina: number; agendar: number }): Promise<Orcamento[]> {
  const base = `http://localhost:${porta}`;
  const srv = await subirServidor(porta, { ...ENV_BASE, DATABASE_URL: dbUrl, NEXT_PUBLIC_SITE_URL: base });
  const o: Orcamento[] = [];
  try {
    for (const p of ['/', '/sobre', '/politica-de-privacidade']) {
      const m = await medir(`${base}${p}`);
      o.push({ nome: `[${nome}] ${p} responde 200 em ≤ ${limites.pagina} ms`, ok: m.status === 200 && m.ms <= limites.pagina, detalhe: `${m.status} em ${Math.round(m.ms)} ms` });
    }

    const t = performance.now();
    const r = await fetch(`${base}/agendar`, { signal: AbortSignal.timeout(30_000) });
    const html = await r.text();
    const ms = performance.now() - t;
    o.push({ nome: `[${nome}] /agendar cai no WhatsApp em ≤ ${limites.agendar} ms`, ok: r.status === 200 && html.includes('Agendar pelo WhatsApp') && ms <= limites.agendar, detalhe: `${r.status} em ${Math.round(ms)} ms` });

    const h = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(30_000) });
    const corpoH = await h.json() as { status?: string };
    o.push({ nome: `[${nome}] /api/health = 503 e status:fora`, ok: h.status === 503 && corpoH.status === 'fora', detalhe: `${h.status} ${JSON.stringify(corpoH)}` });

    const hoje = new Date().toISOString().slice(0, 10);
    for (const [rota, init] of [
      [`/api/disponibilidade?tipo=consulta-presencial&de=${hoje}&ate=${hoje}`, undefined],
      ['/api/agendamentos', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ tipo: 'consulta-presencial', inicio: new Date(Date.now() + 86_400_000).toISOString(), site: '',
          paciente: { nome: 'Ana Souza', telefone: '11987654321', email: 'ana@exemplo.com', consentimentoDados: true } }) }],
    ] as const) {
      const resp = await fetch(`${base}${rota}`, { ...(init ?? {}), signal: AbortSignal.timeout(30_000) });
      const texto = await resp.text();
      const vaza = /postgres|ECONNREFUSED|at \w+ \(|stack|SELECT|INSERT|DATABASE_URL/i.test(texto);
      o.push({ nome: `[${nome}] ${rota.split('?')[0]} falha com erro genérico, sem vazar detalhe`, ok: resp.status >= 500 && !vaza, detalhe: `${resp.status} ${texto.slice(0, 120)}` });
    }
  } finally {
    derrubar(srv);
  }
  return o;
}

async function main() {
  // Buraco negro: aceita TCP e nunca responde.
  const buraco = net.createServer(() => { /* segura a conexão aberta */ });
  await new Promise<void>((r) => buraco.listen(55999, '127.0.0.1', () => r()));
  try {
    const o = [
      ...await cenario('banco recusando', 3402, 'postgresql://postgres@127.0.0.1:1/nada', { pagina: 1500, agendar: 3000 }),
      ...await cenario('banco sem resposta', 3403, 'postgresql://postgres@127.0.0.1:55999/nada', { pagina: 2500, agendar: 5000 }),
    ];
    relatar(o, { cenarios: ['banco recusando', 'banco sem resposta'] });
  } finally {
    buraco.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
