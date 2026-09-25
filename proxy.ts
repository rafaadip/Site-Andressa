/**
 * Proxy (Next 16; antes "middleware"). Roda antes de toda página:
 *
 * 1. /admin/* sem sessão válida → /admin/entrar. É a PRIMEIRA porta; cada
 *    página e ação do painel confere a sessão de novo (lib/auth/admin.ts).
 * 2. CSP com nonce novo por requisição (lib/csp.ts). O Next lê o nonce do
 *    cabeçalho e o aplica aos próprios scripts — por isso as páginas são
 *    renderizadas dinamicamente (docs/adr/ADR-006-integracoes-sem-sdk-e-painel.md).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { lerSessao, nomeCookieSessao } from '@/lib/auth/sessao';
import { montarCsp } from '@/lib/csp';
import { urlSite } from '@/lib/seo';

const PUBLICAS_DO_ADMIN = ['/admin/entrar'];

/** Métodos de diagnóstico não existem aqui (pentest PT-04: TRACE dava 500). */
const METODOS_RECUSADOS = new Set(['TRACE', 'TRACK', 'CONNECT']);

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (METODOS_RECUSADOS.has(req.method.toUpperCase())) {
    return new NextResponse(null, { status: 405, headers: { Allow: 'GET, HEAD, POST' } });
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const publica = PUBLICAS_DO_ADMIN.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (!publica && !lerSessao(req.cookies.get(nomeCookieSessao())?.value)) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/entrar';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = montarCsp(nonce, {
    dev: process.env.NODE_ENV === 'development',
    https: urlSite().startsWith('https://'),
  });
  const cabecalhos = new Headers(req.headers);
  cabecalhos.set('x-nonce', nonce);
  cabecalhos.set('Content-Security-Policy', csp);

  const resp = NextResponse.next({ request: { headers: cabecalhos } });
  resp.headers.set('Content-Security-Policy', csp);
  return resp;
}

export const config = {
  // Páginas e ações; fora: API (sem HTML), assets estáticos e arquivos gerados.
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|icon.svg|retratos/|robots.txt|sitemap.xml|opengraph-image|twitter-image).*)'],
};
