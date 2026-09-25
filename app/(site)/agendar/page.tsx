import type { Metadata } from 'next';
import { TriangleAlert } from 'lucide-react';
import { PROFISSIONAL } from '@/lib/config';
import { URGENCIA } from '@/lib/content/site';
import { dataLocal, TZ_CLINICA } from '@/lib/datetime';
import type { TipoConsultaPublico } from '@/lib/agendamento/tipos';
import { Secao } from '@/components/ui/Secao';
import { FluxoAgendamento } from '@/components/agendamento/FluxoAgendamento';
import { AgendarPorContato } from '@/components/agendamento/AgendarPorContato';
import { comLimiteDeTempo, ESGOTOU } from '@/lib/limite-tempo';

export const metadata: Metadata = {
  title: 'Agendar consulta',
  description: `Agende online uma consulta presencial em ${PROFISSIONAL.cidade}–${PROFISSIONAL.uf} ou por teleconsulta, sem cadastro.`,
  alternates: { canonical: '/agendar' },
};

// Horários mudam a cada agendamento: nunca pré-renderizar.
export const dynamic = 'force-dynamic';

type Oferta = { tipos: TipoConsultaPublico[]; horizonteDias: number };
const SEM_OFERTA: Oferta = { tipos: [], horizonteDias: 0 };

/** Banco lento não pode deixar a página em branco: em 2,5 s, cai no WhatsApp. */
const LIMITE_MS = 2500;

async function carregarOferta(): Promise<Oferta> {
  const { log } = await import('@/lib/log');
  try {
    const { listarTipos, profissional } = await import('@/lib/agendamento/servico');
    const { agendamentoOnlineHabilitado } = await import('@/lib/calendar/freebusy');
    const oferta = await comLimiteDeTempo((async (): Promise<Oferta> => {
      const prof = await profissional();
      if (!(await agendamentoOnlineHabilitado(prof.id))) return SEM_OFERTA;
      return { tipos: await listarTipos(), horizonteDias: prof.horizonDays };
    })(), LIMITE_MS);
    if (oferta === ESGOTOU) {
      log.aviso('agendar.banco-lento', { limiteMs: LIMITE_MS });
      return SEM_OFERTA;
    }
    return oferta;
  } catch (e) {
    // Banco fora do ar não pode derrubar a página: cai no WhatsApp.
    log.excecao('agendar.sem-banco', e);
    return SEM_OFERTA;
  }
}

export default async function PaginaAgendar() {
  const { tipos, horizonteDias } = await carregarOferta();
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
            ? <FluxoAgendamento tipos={tipos} hoje={dataLocal(new Date())} fuso={TZ_CLINICA} horizonteDias={horizonteDias} />
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
