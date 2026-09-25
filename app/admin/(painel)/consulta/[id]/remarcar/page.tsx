import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { consultaPorId, horariosParaRemarcar } from '@/lib/agendamento/admin';
import { dataLocal, formatarDia, formatarParaPaciente, horaLocalParaUtc, somarDiasLocal } from '@/lib/datetime';
import { FormRemarcar } from '@/components/admin/FormRemarcar';

export const metadata: Metadata = { title: 'Remarcar' };

const JANELA = 14;

export default async function Remarcar({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ de?: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const c = await consultaPorId(id);
  if (!c || c.status !== 'confirmed') notFound();

  const hoje = dataLocal(new Date());
  const pedido = (await searchParams).de;
  const de = pedido && /^\d{4}-\d{2}-\d{2}$/.test(pedido) && pedido >= hoje ? pedido : hoje;
  const ate = somarDiasLocal(de, JANELA - 1);
  const disp = await horariosParaRemarcar(id, de, ate);
  const dias = disp.dias.map((d) => ({
    data: d.data,
    titulo: formatarDia(horaLocalParaUtc(d.data, '12:00')),
    slots: d.slots.map((s) => ({ inicio: s.inicio, rotulo: s.rotulo })),
  }));

  return (
    <div className="mx-auto max-w-[46rem]">
      <Link href={`/admin/consulta/${id}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-acento"><ArrowLeft aria-hidden size={16} />Voltar</Link>
      <h1 className="display mt-3 text-h3 text-texto">Remarcar {c.nome}</h1>
      <p className="mt-1 text-sm text-texto-2 first-letter:uppercase">Hoje: {formatarParaPaciente(c.inicio)} · {c.tipo}</p>

      <nav aria-label="Período" className="mt-6 flex items-center justify-between gap-2">
        {de > hoje
          ? <Link href={`?de=${somarDiasLocal(de, -JANELA) < hoje ? hoje : somarDiasLocal(de, -JANELA)}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-acento"><ChevronLeft aria-hidden size={16} />Anteriores</Link>
          : <span />}
        <Link href={`?de=${somarDiasLocal(de, JANELA)}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-acento">Próximos dias<ChevronRight aria-hidden size={16} /></Link>
      </nav>

      <div className="mt-4">
        <FormRemarcar id={id} dias={dias} />
      </div>
    </div>
  );
}
