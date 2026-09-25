import { MapPin, RefreshCw, Stethoscope, Video } from 'lucide-react';
import { localConsulta } from '@/lib/config';
import { ATENDIMENTO } from '@/lib/content/site';
import { Secao, CabecalhoSecao } from '@/components/ui/Secao';

const ICONES = [Stethoscope, Video, RefreshCw] as const;

/**
 * Sem preço: publicidade médica veda divulgação de valores (FASE-10).
 * Grade: 1 col no celular · 2 no tablet (o 3º ocupa a linha) · 3 no desktop.
 */
export function Atendimento() {
  return (
    <Secao id="atendimento" escura>
      <CabecalhoSecao eyebrow="Atendimento" titulo={ATENDIMENTO.titulo} lead={ATENDIMENTO.lead} />
      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {ATENDIMENTO.modalidades.map((m, i) => {
          const Icone = ICONES[i] ?? Stethoscope;
          return (
            <li
              key={m.titulo}
              className={`flex flex-col rounded-lg border border-borda bg-superficie p-7 lg:p-8
                          ${i === 2 ? 'md:col-span-2 lg:col-span-1' : ''}`}
            >
              <span aria-hidden className="grid size-12 place-items-center rounded-full border border-borda-campo text-acento">
                <Icone size={22} strokeWidth={1.5} />
              </span>
              <h3 className="display text-h3 text-acento mt-6 mb-3">{m.titulo}</h3>
              <p className="text-texto-2 font-light">{m.texto}</p>
              {m.modalidade === 'in_person' && (
                <p className="mt-5 flex gap-2 text-sm text-texto-2">
                  <MapPin aria-hidden size={16} strokeWidth={1.5} className="mt-[.2rem] shrink-0" />
                  <span>{localConsulta(m.modalidade)}</span>
                </p>
              )}
              <p className="eyebrow mt-auto pt-6">{m.etiqueta}</p>
            </li>
          );
        })}
      </ul>
    </Secao>
  );
}
