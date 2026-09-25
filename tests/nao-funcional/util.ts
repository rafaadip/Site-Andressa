/**
 * Utilidades dos testes não funcionais: servidor de produção isolado,
 * medição de latência e orçamento (falha com código ≠ 0 se estourar).
 */
import { spawn, type ChildProcess } from 'node:child_process';

export type Medida = { ms: number; status: number };

export function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const ord = [...valores].sort((a, b) => a - b);
  return ord[Math.min(ord.length - 1, Math.ceil((p / 100) * ord.length) - 1)]!;
}

export function resumo(nome: string, m: Medida[]) {
  const ms = m.map((x) => x.ms);
  const porStatus: Record<number, number> = {};
  for (const x of m) porStatus[x.status] = (porStatus[x.status] ?? 0) + 1;
  return {
    nome, n: m.length,
    p50: Math.round(percentil(ms, 50)), p95: Math.round(percentil(ms, 95)), p99: Math.round(percentil(ms, 99)),
    max: Math.round(Math.max(...ms)), status: porStatus,
  };
}

/** Executa `total` requisições com `concorrencia` simultâneas. */
export async function carga(total: number, concorrencia: number, fazer: (i: number) => Promise<Medida>): Promise<Medida[]> {
  const medidas: Medida[] = [];
  let proxima = 0;
  async function trabalhador() {
    while (proxima < total) {
      const i = proxima++;
      medidas.push(await fazer(i));
    }
  }
  await Promise.all(Array.from({ length: concorrencia }, trabalhador));
  return medidas;
}

export async function medir(url: string, init?: RequestInit): Promise<Medida> {
  const t = performance.now();
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
    await r.arrayBuffer();
    return { ms: performance.now() - t, status: r.status };
  } catch {
    return { ms: performance.now() - t, status: 0 };
  }
}

/** Sobe `next start` numa porta própria, com o ambiente dado, e espera responder. */
export async function subirServidor(porta: number, env: Record<string, string>): Promise<ChildProcess> {
  const proc = spawn('npx', ['next', 'start', '-p', String(porta)], {
    env: { ...process.env, ...env }, stdio: 'ignore', detached: true,
  });
  const limite = Date.now() + 60_000;
  while (Date.now() < limite) {
    try {
      const r = await fetch(`http://localhost:${porta}/robots.txt`, { signal: AbortSignal.timeout(2_000) });
      if (r.ok) return proc;
    } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  derrubar(proc);
  throw new Error(`servidor na porta ${porta} não subiu`);
}

export function derrubar(proc: ChildProcess) {
  try { if (proc.pid) process.kill(-proc.pid, 'SIGTERM'); } catch { /* já caiu */ }
}

export type Orcamento = { nome: string; ok: boolean; detalhe: string };

export function relatar(orcamentos: Orcamento[], dados: unknown) {
  console.log(JSON.stringify(dados, null, 2));
  for (const o of orcamentos) console.log(`${o.ok ? '✓' : '✗'} ${o.nome} — ${o.detalhe}`);
  const falhas = orcamentos.filter((o) => !o.ok);
  if (falhas.length) {
    console.error(`\n${falhas.length} orçamento(s) estourado(s).`);
    process.exit(1);
  }
  console.log(`\n${orcamentos.length} orçamento(s) respeitado(s).`);
}
