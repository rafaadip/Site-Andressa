import type { Metadata } from 'next';
import { exigirAdmin } from '@/lib/auth/admin';
import { CalendarCheck, Mail } from 'lucide-react';
import { estadoPainel } from '@/lib/agendamento/admin';
import { formatarCurto } from '@/lib/datetime';
import { webhookPossivel } from '@/lib/calendar/canal';
import { DESCONECTADA_PELO_PAINEL } from '@/lib/calendar/conexao';
import { DesconectarGoogle, SincronizarAgora } from '@/components/admin/AcoesIntegracao';

export const metadata: Metadata = { title: 'Integrações' };

const ERROS: Record<string, string> = {
  escopo: 'O Google não concedeu as duas permissões de agenda. Conecte de novo e marque as duas opções.',
  'sem-refresh': 'O Google não enviou a autorização permanente. Tente conectar de novo.',
  conta: 'Conecte com a mesma conta do Google usada para entrar no painel.',
  'agenda-real': 'Este ambiente é de testes e não pode usar a agenda real. Use uma conta de teste.',
  negado: 'A conexão foi cancelada.',
  google: 'O Google não respondeu. Tente de novo em instantes.',
};

function Estado({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 font-medium text-texto">
      <span aria-hidden className={`size-2.5 rounded-full ${ok ? 'bg-success' : 'bg-danger'}`} />{children}
    </p>
  );
}

export default async function Integracoes({ searchParams }: { searchParams: Promise<{ conectado?: string; erro?: string }> }) {
  // Defesa em profundidade: o layout pode não reexecutar numa navegação
  // parcial; a página confere a sessão por conta própria (SEC-15).
  await exigirAdmin();
  const { conectado, erro } = await searchParams;
  const e = await estadoPainel();
  const conectar = <a href="/api/oauth/google/start?proposito=agenda" className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-espresso-900 bg-espresso-900 px-6 font-medium text-ivory-100 md:w-auto">{e.google === 'revogado' ? 'Reconectar agora' : 'Conectar Google Agenda'}</a>;

  return (
    <div className="mx-auto max-w-[40rem]">
      <h1 className="display text-h3 text-texto">Integrações</h1>
      {conectado && <p role="status" className="mt-4 rounded-md bg-superficie p-3 text-sm text-texto">Agenda conectada. As consultas marcadas estão sendo enviadas para ela.</p>}
      {erro && ERROS[erro] && <p role="alert" className="mt-4 rounded-md border border-danger/40 p-3 text-sm text-danger">{ERROS[erro]}</p>}

      <section aria-labelledby="titulo-google" className="mt-6 rounded-lg border border-borda bg-elevado p-5">
        <h2 id="titulo-google" className="flex items-center gap-2 font-medium text-texto"><CalendarCheck aria-hidden size={20} className="text-acento" />Google Agenda</h2>
        <div className="mt-3 space-y-1 text-sm">
          {e.google === 'conectado' && <>
            <Estado ok>Conectada — {e.contaGoogle}</Estado>
            <p className="text-texto-2">Última leitura da agenda: {e.ultimaSincronizacao ? formatarCurto(e.ultimaSincronizacao) : 'ainda não'}.</p>
            <p className="text-texto-2">{e.canalExpiraEm ? `Avisos instantâneos ativos até ${formatarCurto(e.canalExpiraEm)} (renovados sozinhos).` : webhookPossivel() ? 'Avisos instantâneos ainda não registrados — a leitura a cada 15 minutos cobre.' : 'Ambiente sem HTTPS: a agenda é lida a cada 15 minutos.'}</p>
            <p className="text-texto-2">Fila: {e.filaSync.pendentes} a enviar · {e.filaSync.falhas} com falha{e.erroGoogle ? ` · último erro: ${e.erroGoogle}` : ''}.</p>
          </>}
          {e.google === 'revogado' && <>
            <Estado ok={false}>Desconectada{e.contaGoogle ? ` — ${e.contaGoogle}` : ''}</Estado>
            <p className="text-texto-2">{e.erroGoogle === DESCONECTADA_PELO_PAINEL ? 'Você desconectou a agenda.' : 'O acesso foi revogado ou expirou.'} Até reconectar, o site só oferece horários a partir de depois de amanhã.</p>
          </>}
          {e.google === 'desconectado' && <Estado ok={false}>Não conectada</Estado>}
          {e.google === 'nao-configurado' && <p className="text-texto-2">As credenciais do Google (GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET) não estão configuradas neste ambiente.</p>}
        </div>
        <div className="mt-4 flex flex-col gap-2 md:flex-row md:flex-wrap">
          {e.google !== 'nao-configurado' && e.google !== 'conectado' && conectar}
          {e.google === 'conectado' && <><SincronizarAgora /><DesconectarGoogle /></>}
        </div>
      </section>

      <section aria-labelledby="titulo-email" className="mt-4 rounded-lg border border-borda bg-elevado p-5">
        <h2 id="titulo-email" className="flex items-center gap-2 font-medium text-texto"><Mail aria-hidden size={20} className="text-acento" />E-mail</h2>
        <div className="mt-3 space-y-1 text-sm">
          {e.email === 'ativo'
            ? <><Estado ok>Ativo</Estado><p className="text-texto-2">Últimos 7 dias: {e.emails7d.enviados} enviados · {e.emails7d.falhas} com falha definitiva.</p>
                {e.bounces > 0 && <p className="text-danger">{e.bounces} consulta(s) futura(s) com e-mail que voltou.</p>}</>
            : <><Estado ok={false}>Não configurado</Estado><p className="text-texto-2">Sem RESEND_API_KEY e EMAIL_FROM, nenhum e-mail sai. O paciente leva a consulta pelos botões de calendário da tela de confirmação.</p></>}
        </div>
      </section>
    </div>
  );
}
