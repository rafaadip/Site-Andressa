import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { exigirAdmin } from '@/lib/auth/admin';
import { estadoPainel } from '@/lib/agendamento/admin';
import { PROFISSIONAL } from '@/lib/config';
import { NavAdminRodape, NavAdminTopo } from '@/components/admin/NavAdmin';
import { acaoSair } from './acoes';

/**
 * Casca do painel. A faixa de alerta aparece em TODAS as telas quando a
 * agenda do Google cai: sem ela o site não enxerga os plantões, e um ponto
 * cinza numa página de configurações seria ignorado (FASE-09 §3.3).
 */
export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  await exigirAdmin();
  const estado = await estadoPainel();

  const alertas: { texto: string; href: string; acao: string }[] = [];
  if (estado.google === 'revogado') {
    alertas.push({ texto: 'Sua agenda do Google está desconectada: o site não enxerga seus plantões e só oferece horários a partir de depois de amanhã.', href: '/admin/integracoes', acao: 'Reconectar' });
  } else if (estado.google === 'desconectado') {
    alertas.push({ texto: 'Conecte sua agenda do Google para o site enxergar seus compromissos e receber as consultas.', href: '/admin/integracoes', acao: 'Conectar' });
  }
  if (estado.filaSync.falhas > 0) {
    alertas.push({ texto: `${estado.filaSync.falhas} consulta(s) ainda não chegaram à sua agenda do Google.`, href: '/admin/integracoes', acao: 'Ver' });
  }
  if (estado.bounces > 0) {
    alertas.push({ texto: `${estado.bounces} paciente(s) com e-mail que voltou — confirme por WhatsApp.`, href: '/admin', acao: 'Ver agenda' });
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-borda bg-fundo/95 backdrop-blur-md">
        <div className="wrap flex h-16 items-center justify-between gap-4">
          <Link href="/admin" className="leading-tight">
            <span className="block font-display text-[1.125rem] font-semibold text-texto">Painel</span>
            <span className="block text-[.75rem] text-texto-2">{PROFISSIONAL.nomeCurto}</span>
          </Link>
          <NavAdminTopo />
          <form action={acaoSair}>
            <button type="submit" className="inline-flex min-h-11 items-center rounded-full px-3 text-sm text-texto-2 hover:text-texto">Sair</button>
          </form>
        </div>
      </header>

      {alertas.length > 0 && (
        <div role="region" aria-label="Avisos" className="border-b border-danger/30 bg-superficie">
          <ul className="wrap divide-y divide-borda">
            {alertas.map((a) => (
              <li key={a.texto} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                <p className="flex gap-2 text-sm text-texto">
                  <TriangleAlert aria-hidden size={18} className="mt-0.5 shrink-0 text-danger" />{a.texto}
                </p>
                <Link href={a.href} className="inline-flex min-h-11 shrink-0 items-center self-start font-medium text-acento underline underline-offset-4 md:self-auto">{a.acao}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* pb extra no celular: a barra de navegação fixa não cobre o conteúdo. */}
      <main id="conteudo" tabIndex={-1} className="wrap pt-6 pb-[calc(6rem+var(--safe-bottom))] outline-none md:pt-10 md:pb-16">
        {children}
      </main>
      <NavAdminRodape />
    </>
  );
}
