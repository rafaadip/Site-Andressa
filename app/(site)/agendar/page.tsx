import type { Metadata } from 'next';
import { TriangleAlert } from 'lucide-react';
import { PROFISSIONAL } from '@/lib/config';
import { URGENCIA } from '@/lib/content/site';
import { dataLocal, TZ_CLINICA } from '@/lib/datetime';
import type { TipoConsultaPublico } from '@/lib/agendamento/tipos';
import { agendamentoOnlineHabilitado } from '@/lib/calendar/freebusy';
import { Secao } from '@/components/ui/Secao';
import { FluxoAgendamento } from '@/components/agendamento/FluxoAgendamento';
import { AgendarPorContato } from '@/components/agendamento/AgendarPorContato';

export const metadata: Metadata = {
  title: 'Agendar consulta',
  description: `Agende online uma consulta presencial em ${PROFISSIONAL.cidade}–${PROFISSIONAL.uf} ou por teleconsulta, sem cadastro.`,
  alternates: { canonical: '/agendar' },
};

// Horários mudam a cada agendamento: nunca pré-renderizar.
export const dynamic = 'force-dynamic';

async function carregarTipos(): Promise<TipoConsultaPublico[]> {
  if (!agendamentoOnlineHabilitado()) return [];
  try {
    const { listarTipos } = await import('@/lib/agendamento/servico');
    return await listarTipos();
  } catch (e) {
    // Banco fora do ar não pode derrubar a página: cai no WhatsApp.
    console.error('[agendar] sem acesso aos tipos de consulta:', e instanceof Error ? e.message : e);
    return [];
  }
}

export default async function PaginaAgendar() {
  const tipos = await carregarTipos();
  const online = tipos.length > 0;

  return (
    <Secao className="pt-8 md:pt-[var(--section-y)]">
      <div className="mx-auto max-w-[46rem]">
        <header className="mb-8 md:mb-10">
          <p className="eyebrow">Agendamento</p>
          <h1 className="display text-h2 text-texto mt-3">Agende sua consulta</h1>
          {online && (
            <p className="mt-3 text-texto-2 font-light">
              Três passos, sem cadastro. A consulta vai direto para o calendário do seu celular.
            </p>
          )}
        </header>

        <div className="md:rounded-lg md:border md:border-borda md:bg-elevado md:p-10 md:shadow-md md:border-t-4 md:border-t-gold-500">
          {online
            ? <FluxoAgendamento tipos={tipos} hoje={dataLocal(new Date())} fuso={TZ_CLINICA} />
            : <AgendarPorContato />}
        </div>

        <aside className="mt-10 flex gap-4 rounded-lg border border-borda bg-superficie p-5">
          <TriangleAlert aria-hidden size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-danger" />
          <p className="text-sm text-texto-2">
            <strong className="font-medium text-texto">{URGENCIA.titulo}</strong>{' '}
            {URGENCIA.texto} <strong className="text-texto">{URGENCIA.telefone}</strong>.
          </p>
        </aside>
      </div>
    </Secao>
  );
}
