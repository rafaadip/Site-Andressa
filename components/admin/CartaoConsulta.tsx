import Link from 'next/link';
import { ChevronRight, MessageCircle, Phone, Video, MapPin } from 'lucide-react';
import type { ItemAgenda } from '@/lib/agendamento/admin';
import { horaLocal } from '@/lib/datetime';

/** "+5511912345678" → "(11) 91234-5678" */
export function telefoneLegivel(e164: string): string {
  const d = e164.replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return e164;
}

export function linkWhatsPaciente(e164: string, texto?: string) {
  const base = `https://wa.me/${e164.replace(/\D/g, '')}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}

/**
 * Uma consulta na agenda. Telefone e WhatsApp a UM toque (FASE-09 §3.1);
 * o motivo aparece aqui — dado de saúde, só atrás do login.
 */
export function CartaoConsulta({ c }: { c: ItemAgenda }) {
  const Icone = c.modalidade === 'telehealth' ? Video : MapPin;
  return (
    <article className="rounded-lg border border-borda bg-elevado p-4 md:p-5">
      <div className="flex items-start gap-4">
        {/* Fonte do corpo: a Playfair usa algarismos "old-style", ruins de ler de relance. */}
        <p className="pt-0.5 text-[1.25rem] font-medium leading-none tabular text-texto">{horaLocal(c.inicio)}</p>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-texto">{c.nome}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-texto-2">
            <Icone aria-hidden size={14} strokeWidth={1.75} />{c.tipo} · {c.duracaoMin} min
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {c.status === 'no_show' && <Selo>Faltou</Selo>}
            {c.emailInvalido && <Selo>E-mail não entregue</Selo>}
            {(c.syncState === 'failed') && <Selo>Fora da agenda do Google</Selo>}
          </div>
        </div>
      </div>

      {c.motivo && (
        <p className="mt-3 rounded-md bg-superficie px-3 py-2 text-sm text-texto">
          <span className="sr-only">Motivo: </span>“{c.motivo}”
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <a href={`tel:${c.telefone}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-borda-campo px-4 text-sm font-medium text-texto">
          <Phone aria-hidden size={16} strokeWidth={1.75} /><span className="tabular">{telefoneLegivel(c.telefone)}</span>
        </a>
        <a href={linkWhatsPaciente(c.telefone)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-borda-campo px-4 text-sm font-medium text-texto">
          <MessageCircle aria-hidden size={16} strokeWidth={1.75} />WhatsApp
        </a>
        <Link href={`/admin/consulta/${c.id}`} className="ml-auto inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-medium text-acento">
          Detalhes<span className="sr-only"> de {c.nome}</span><ChevronRight aria-hidden size={16} />
        </Link>
      </div>
    </article>
  );
}

function Selo({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-danger/40 px-2 py-0.5 text-[.75rem] text-danger">{children}</span>;
}
