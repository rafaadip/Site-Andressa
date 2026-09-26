import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { adminConfigurado } from '@/lib/env';
import { sessaoAtual } from '@/lib/auth/admin';
import { PROFISSIONAL } from '@/lib/config';

export const metadata: Metadata = { title: 'Entrar' };

const ERROS: Record<string, string> = {
  conta: 'Essa conta do Google não tem acesso ao painel.',
  estado: 'O login expirou ou foi aberto em outra aba. Tente de novo.',
  negado: 'O login foi cancelado.',
  token: 'O Google não confirmou a identidade. Tente de novo.',
  google: 'O Google não respondeu. Tente de novo em instantes.',
  config: 'O painel ainda não foi configurado neste ambiente.',
};

export default async function Entrar({ searchParams }: { searchParams: Promise<{ erro?: string; saiu?: string }> }) {
  if (await sessaoAtual()) redirect('/admin');
  const { erro, saiu } = await searchParams;
  const configurado = adminConfigurado();

  return (
    <main id="conteudo" className="wrap grid min-h-dvh place-items-center py-10">
      <div className="w-full max-w-[26rem] rounded-lg border border-borda bg-elevado p-6 shadow-md md:p-8">
        <p className="eyebrow">Painel</p>
        <h1 className="display mt-2 text-h3 text-texto">{PROFISSIONAL.nomeCurto}</h1>
        <p className="mt-2 text-sm text-texto-2">Acesso restrito. Entre com a conta do Google autorizada.</p>

        {erro && ERROS[erro] && <p role="alert" className="mt-5 rounded-md border border-danger/40 p-3 text-sm text-danger">{ERROS[erro]}</p>}
        {saiu && <p role="status" className="mt-5 text-sm text-texto-2">Você saiu do painel.</p>}

        {configurado ? (
          // <a> nativo: é navegação para o Google, não rota interna.
          <a
            href="/api/oauth/google/start?proposito=login"
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-floresta-900 bg-floresta-900 px-6 font-medium text-ivory-100 hover:bg-floresta-700"
          >
            <LogIn aria-hidden size={18} /> Entrar com Google
          </a>
        ) : (
          <p className="mt-6 text-sm text-texto-2">
            Defina AUTH_SECRET, ADMIN_EMAIL e as credenciais do Google (GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET) para ativar o painel.
          </p>
        )}
      </div>
    </main>
  );
}
