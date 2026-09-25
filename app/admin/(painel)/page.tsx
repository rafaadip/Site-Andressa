import type { Metadata } from 'next';
import { exigirAdmin } from '@/lib/auth/admin';
import Link from 'next/link';
import { CalendarPlus } from 'lucide-react';
import { agenda, type ItemAgenda } from '@/lib/agendamento/admin';
import { dataLocal, formatarDia, somarDiasLocal } from '@/lib/datetime';
import { CartaoConsulta } from '@/components/admin/CartaoConsulta';
import { BloquearRestoDeHoje } from '@/components/admin/BloquearRestoDeHoje';

export const metadata: Metadata = { title: 'Agenda' };

const FEITO: Record<string, string> = { cancelada: 'Consulta cancelada. O paciente foi avisado por e-mail, se você marcou essa opção.' };

function agrupar(itens: ItemAgenda[]) {
  const grupos = new Map<string, ItemAgenda[]>();
  for (const c of itens) {
    const d = dataLocal(c.inicio);
    grupos.set(d, [...(grupos.get(d) ?? []), c]);
  }
  return grupos;
}

export default async function Agenda({ searchParams }: { searchParams: Promise<{ feito?: string }> }) {
  // Defesa em profundidade: o layout pode não reexecutar numa navegação
  // parcial; a página confere a sessão por conta própria (SEC-15).
  await exigirAdmin();
  const { feito } = await searchParams;
  const agora = new Date();
  const hoje = dataLocal(agora);
  const amanha = somarDiasLocal(hoje, 1);
  const itens = await agenda(30, agora);
  const grupos = agrupar(itens);
  const deHoje = grupos.get(hoje) ?? [];
  grupos.delete(hoje);

  return (
    <div className="mx-auto max-w-[46rem]">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">Hoje</p>
          <h1 className="display mt-1 text-h3 text-texto first-letter:uppercase">{formatarDia(agora)}</h1>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <BloquearRestoDeHoje />
          <Link href="/admin/disponibilidade/bloquear" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-acento underline underline-offset-4">
            <CalendarPlus aria-hidden size={16} />Bloquear outro período
          </Link>
        </div>
      </header>

      {feito && FEITO[feito] && <p role="status" className="mt-4 rounded-md bg-superficie p-3 text-sm text-texto">{FEITO[feito]}</p>}

      <section aria-labelledby="titulo-hoje" className="mt-6">
        <h2 id="titulo-hoje" className="sr-only">Consultas de hoje</h2>
        {deHoje.length === 0
          ? <p className="rounded-lg border border-borda bg-superficie p-5 text-texto-2">Nenhuma consulta hoje.</p>
          : <ul className="space-y-3">{deHoje.map((c) => <li key={c.id}><CartaoConsulta c={c} /></li>)}</ul>}
      </section>

      <section aria-labelledby="titulo-proximas" className="mt-10">
        <h2 id="titulo-proximas" className="font-medium text-texto">Próximos 30 dias</h2>
        {grupos.size === 0 && <p className="mt-2 text-sm text-texto-2">Nenhuma consulta marcada.</p>}
        <div className="mt-3 divide-y divide-borda border-y border-borda">
          {[...grupos.entries()].map(([data, lista]) => (
            <details key={data} open={data === amanha} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-2 text-texto">
                <span className="first-letter:uppercase">
                  {data === amanha && <strong className="font-medium">Amanhã · </strong>}
                  {formatarDia(lista[0]!.inicio)}
                </span>
                <span className="rounded-full bg-superficie px-2.5 py-0.5 text-sm tabular text-texto-2">{lista.length}</span>
              </summary>
              <ul className="space-y-3 pb-4">{lista.map((c) => <li key={c.id}><CartaoConsulta c={c} /></li>)}</ul>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
