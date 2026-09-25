/**
 * Content-Security-Policy estrita (FASE-13 §3): script só com nonce da
 * requisição — nada de `unsafe-inline` em script. Possível porque não há
 * script de terceiro (ADR-005); a única exceção opcional é o Plausible.
 *
 * Estilo mantém `unsafe-inline`: atributos `style` (placeholder do
 * next/image, React) não aceitam nonce. Estilo não executa código.
 */
export function analyticsHost(): string | null {
  return process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ? 'https://plausible.io' : null;
}

export function montarCsp(nonce: string, opcoes: { dev?: boolean; https?: boolean } = {}): string {
  const analytics = analyticsHost();
  const diretivas = [
    "default-src 'self'",
    // 'strict-dynamic': chunks carregados por um script com nonce herdam a confiança.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${opcoes.dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${analytics ? ` ${analytics}` : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    // Em http://localhost, "upgrade" quebraria os próprios assets.
    ...(opcoes.https ? ['upgrade-insecure-requests'] : []),
  ];
  return diretivas.join('; ');
}
