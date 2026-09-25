import { after, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { trocarCodigo } from '@/lib/calendar/google';
import { receberDaAgenda } from '@/lib/calendar/receber';
import { reconciliar } from '@/lib/calendar/sincronizar';
import { concluirConexaoAgenda, concluirLogin, conferirEstado } from '@/lib/auth/oauth';
import { criarSessao, DURACAO_SESSAO_S, lerSessao, nomeCookieOauth, nomeCookieSessao, opcoesCookie } from '@/lib/auth/sessao';
import { practitionerId } from '@/lib/agendamento/servico';
import { log } from '@/lib/log';
import { urlSite } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/** GET /api/oauth/google/callback — retorno dos dois fluxos (login e agenda). */
export async function GET(req: Request) {
  const base = urlSite();
  const url = new URL(req.url);
  const jar = await cookies();
  const proposito = conferirEstado(jar.get(nomeCookieOauth())?.value, url.searchParams.get('state'));

  const sair = (destino: string) => {
    const r = NextResponse.redirect(`${base}${destino}`);
    r.cookies.set(nomeCookieOauth(), '', opcoesCookie(0));
    r.headers.set('Cache-Control', 'no-store');
    return r;
  };

  if (!proposito) return sair('/admin/entrar?erro=estado');
  const code = url.searchParams.get('code');
  if (!code || url.searchParams.get('error')) {
    return sair(proposito === 'agenda' ? '/admin/integracoes?erro=negado' : '/admin/entrar?erro=negado');
  }

  try {
    const tokens = await trocarCodigo(code, `${base}/api/oauth/google/callback`);

    if (proposito === 'login') {
      const r = await concluirLogin(tokens);
      if (!r.ok) return sair(`/admin/entrar?erro=${r.motivo}`);
      const resp = sair('/admin');
      resp.cookies.set(nomeCookieSessao(), criarSessao(r.email), opcoesCookie(DURACAO_SESSAO_S));
      return resp;
    }

    // Conectar a agenda exige estar logada.
    if (!lerSessao(jar.get(nomeCookieSessao())?.value)) return sair('/admin/entrar');
    const pid = await practitionerId();
    const r = await concluirConexaoAgenda(pid, tokens);
    if (!r.ok) return sair(`/admin/integracoes?erro=${r.motivo}`);

    // Primeira leitura (pega o syncToken) e envio do que já estava na fila.
    after(async () => {
      try { await receberDaAgenda(pid); } catch (e) { log.excecao('google.conectar.receber', e); }
      try { await reconciliar(); } catch (e) { log.excecao('google.conectar.reconciliar', e); }
    });
    return sair('/admin/integracoes?conectado=1');
  } catch (e) {
    log.excecao('oauth.callback', e, { proposito });
    return sair(proposito === 'agenda' ? '/admin/integracoes?erro=google' : '/admin/entrar?erro=google');
  }
}
