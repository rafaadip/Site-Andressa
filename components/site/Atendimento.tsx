import { MapPin, RefreshCw, Stethoscope, Video } from 'lucide-react';
import { localConsulta } from '@/lib/config';
import { ATENDIMENTO } from '@/lib/content/site';
import { Secao, CabecalhoSecao } from '@/components/ui/Secao';

const ICONES = [Stethoscope, Video, RefreshCw] as const;

/**
 * O bloco escuro (verde-floresta) do meio da página — o contraponto —, agora
 * como um painel recuado das bordas, com halo oliva e cartões de vidro
 * escuro que acendem sob o ponteiro (Holofote.tsx).
 * Sem preço: publicidade médica veda divulgação de valores (FASE-10).
 * Grade: 1 col no celular · 2 no tablet (o 3º ocupa a linha) · 3 no desktop.
 */
export function Atendimento() {
  return (
    <Secao
      id="atendimento"
      escura
      className="secao-halo mx-2 rounded-[1.75rem] md:mx-4 lg:mx-6 lg:rounded-[2.5rem]"
    >
      <CabecalhoSecao eyebrow="Atendimento" titulo={ATENDIMENTO.titulo} lead={ATENDIMENTO.lead} lado />
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {ATENDIMENTO.modalidades.map((m, i) => {
          const Icone = ICONES[i] ?? Stethoscope;
          return (
            <li
              key={m.titulo}
              data-revelar
              data-holofote
              className={`cartao holofote vidro-escuro flex flex-col rounded-[1.25rem] p-7 md:p-8
                          ${i === 2 ? 'md:col-span-2 lg:col-span-1' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <span aria-hidden className="anel-icone grid size-12 place-items-center rounded-full border border-borda-campo text-acento">
                  <Icone size={21} strokeWidth={1.5} />
                </span>
                <span className="eyebrow rounded-full border border-borda px-3 py-1.5 text-[0.6875rem] leading-none">
                  {m.etiqueta}
                </span>
              </div>
              <h3 className="titulo-display mt-10 text-[1.625rem] text-texto md:text-[1.75rem]">{m.titulo}</h3>
              <p className="mt-3 text-texto-2 leading-relaxed">{m.texto}</p>
              {m.modalidade === 'in_person' && (
                <p className="mt-6 flex gap-2.5 border-t border-borda pt-5 text-sm text-texto-2">
                  <MapPin aria-hidden size={16} strokeWidth={1.5} className="mt-[.2rem] shrink-0 text-acento" />
                  <span>{localConsulta(m.modalidade)}</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Secao>
  );
}
