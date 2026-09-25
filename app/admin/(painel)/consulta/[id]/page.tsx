import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarClock, Mail, MessageCircle, Phone } from 'lucide-react';
import { consultaPorId } from '@/lib/agendamento/admin';
import { formatarParaPaciente } from '@/lib/datetime';
import { localConsulta } from '@/lib/config';
import { linkWhatsPaciente, telefoneLegivel } from '@/components/admin/CartaoConsulta';
import { FormCancelar } from '@/components/admin/FormCancelar';
import { FormFalta } from '@/components/admin/FormFalta';
import { BotaoCopiar } from '@/components/admin/BotaoCopiar';

export const metadata: Metadata = { title: 'Consulta' };

const STATUS: Record<string, string> = {
  confirmed: 'Confirmada', cancelled: 'Cancelada', no_show: 'Faltou', completed: 'Realizada', expired: 'Expirada', held: 'Reservada',
};

export default async function DetalheConsulta({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ feito?: string }>;
}) {
  const { id } = await params;
  const { feito } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const c = await consultaPorId(id);
  if (!c) notFound();

  const agora = new Date();
  const quando = formatarParaPaciente(c.inicio);
  const futura = c.inicio > agora;
  const dados = `${c.nome} · ${telefoneLegivel(c.telefone)} · ${c.email} · ${quando} · ${c.tipo}`;

  return (
    <div className="mx-auto max-w-[40rem]">
      <Link href="/admin" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-acento"><ArrowLeft aria-hidden size={16} />Agenda</Link>
      <p className="eyebrow mt-4">{STATUS[c.status] ?? c.status}</p>
      <h1 className="display mt-1 text-h3 text-texto">{c.nome}</h1>
      <p className="mt-1 text-texto first-letter:uppercase">{quando}</p>
      <p className="text-sm text-texto-2">{c.tipo} · {c.duracaoMin} min · {localConsulta(c.modalidade)}</p>

      {feito === 'remarcada' && <p role="status" className="mt-4 rounded-md bg-superficie p-3 text-sm text-texto">Consulta remarcada. O paciente recebe o novo horário por e-mail, com o convite atualizado.</p>}

      <dl className="mt-6 divide-y divide-borda border-y border-borda">
        <div className="flex items-center justify-between gap-3 py-3">
          <dt className="sr-only">Telefone</dt>
          <dd className="flex flex-wrap gap-2">
            <a href={`tel:${c.telefone}`} className="inline-flex min-h-11 items-center gap-2 font-medium text-texto"><Phone aria-hidden size={16} /><span className="tabular">{telefoneLegivel(c.telefone)}</span></a>
          </dd>
          <a href={linkWhatsPaciente(c.telefone)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-acento"><MessageCircle aria-hidden size={16} />WhatsApp</a>
        </div>
        <div className="py-3">
          <dt className="sr-only">E-mail</dt>
          <dd><a href={`mailto:${c.email}`} className="inline-flex min-h-11 items-center gap-2 break-all text-texto"><Mail aria-hidden size={16} className="shrink-0" />{c.email}</a>
            {c.emailInvalido && <span className="block text-sm text-danger">O e-mail voltou — confirme a consulta pelo WhatsApp.</span>}</dd>
        </div>
        {c.motivo && (
          <div className="py-3">
            <dt className="eyebrow">Motivo informado</dt>
            <dd className="mt-1 text-texto">“{c.motivo}”</dd>
          </div>
        )}
      </dl>

      <section aria-labelledby="titulo-acoes" className="mt-8 space-y-3">
        <h2 id="titulo-acoes" className="sr-only">Ações</h2>
        {c.status === 'confirmed' && futura && (
          <Link href={`/admin/consulta/${c.id}/remarcar`} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-espresso-900 bg-espresso-900 px-6 font-medium text-ivory-100 md:w-auto">
            <CalendarClock aria-hidden size={18} />Remarcar
          </Link>
        )}
        {(c.status === 'confirmed' && !futura) || c.status === 'no_show' ? <FormFalta id={c.id} faltou={c.status === 'no_show'} /> : null}
        <BotaoCopiar texto={dados} />
        {c.status === 'confirmed' && <div className="pt-4"><FormCancelar id={c.id} futura={futura} /></div>}
      </section>
    </div>
  );
}
