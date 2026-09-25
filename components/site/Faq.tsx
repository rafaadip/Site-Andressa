import { ChevronDown } from 'lucide-react';
import { perguntasFrequentes } from '@/lib/content/site';
import { Secao, CabecalhoSecao } from '@/components/ui/Secao';

/**
 * <details>/<summary> nativos: acessíveis por padrão, funcionam sem JS e
 * alimentam o rich result de FAQ (FASE-11).
 */
export function Faq({ prazoCancelamentoHoras }: { prazoCancelamentoHoras: number }) {
  return (
    <Secao id="perguntas">
      <div className="mx-auto max-w-[46rem]">
        <CabecalhoSecao eyebrow="Dúvidas" titulo="Perguntas frequentes" />
        <div className="border-t border-borda">
          {perguntasFrequentes(prazoCancelamentoHoras).map((f) => (
            <details key={f.pergunta} className="group border-b border-borda">
              <summary
                className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-4
                           text-[1.0625rem] font-medium text-texto [&::-webkit-details-marker]:hidden"
              >
                {f.pergunta}
                <ChevronDown
                  aria-hidden
                  size={20}
                  strokeWidth={1.5}
                  className="shrink-0 text-acento transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <p className="pb-6 pr-10 text-texto-2 font-light">{f.resposta}</p>
            </details>
          ))}
        </div>
      </div>
    </Secao>
  );
}
