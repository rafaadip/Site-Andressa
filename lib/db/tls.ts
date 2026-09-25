/**
 * TLS da conexão com o Postgres (SEC-03).
 *
 * O driver `postgres` vem com `ssl: false` e, mesmo com `sslmode=require`,
 * cifra SEM verificar o certificado (MITM continua possível). Regras:
 *   - `DATABASE_CA_CERT` (PEM da CA do Supabase) → verifica o certificado;
 *   - host remoto sem `sslmode` → no mínimo cifra (`require`); `disable`,
 *     `allow` ou `prefer` (que caem para texto puro) são recusados;
 *   - host local (dev, testes, `next start` do E2E) → vale a URL.
 */
export type OpcaoTls = 'require' | { ca: string; rejectUnauthorized: true };

export class TlsObrigatorioError extends Error {
  constructor() {
    super('Banco remoto exige TLS: use sslmode=require (e DATABASE_CA_CERT para verificar o certificado).');
    this.name = 'TlsObrigatorioError';
  }
}

const HOST_LOCAL = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])$/i;

function hostDa(url: string): string | undefined {
  return /^postgres(?:ql)?:\/\/(?:[^@/]*@)?(\[[^\]]+\]|[^:/?#]+)/i.exec(url)?.[1];
}

/** `undefined` = deixar o `sslmode` da URL decidir (a chave `ssl` nem vai ao driver). */
export function tlsDoBanco(url: string, env: Partial<Record<string, string>> = process.env): OpcaoTls | undefined {
  // Na Vercel o PEM costuma chegar numa linha só, com "\n" literais.
  const ca = env.DATABASE_CA_CERT?.replace(/\\n/g, '\n').trim();
  if (ca) return { ca, rejectUnauthorized: true };
  const host = hostDa(url);
  if (!host || HOST_LOCAL.test(host)) return undefined;
  const modo = /[?&]sslmode=([^&#]+)/.exec(url)?.[1];
  if (modo === 'disable' || modo === 'allow' || modo === 'prefer') throw new TlsObrigatorioError();
  // `require`, `verify-ca`/`verify-full` (o driver verifica com as CAs do sistema) ou nada.
  return modo ? undefined : 'require';
}
