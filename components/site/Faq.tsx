import { perguntasFrequentes } from '@/lib/content/site';
import { Secao, CabecalhoSecao } from '@/components/ui/Secao';

/**
 * <details>/<summary> nativos: acessíveis por padrão, funcionam sem JS e
 * alimentam o rich result de FAQ (FASE-11). A abertura animada é só CSS
 * (::details-content) — onde não há suporte, abre na hora.
 */
export function Faq({ prazoCancelamentoHoras }: { prazoCancelamentoHoras: number }) {
  return (
    <Secao id="perguntas">
      <div className="grid gap-4 lg:grid-cols-[.85fr_1.15fr] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <CabecalhoSecao eyebrow="Dúvidas" titulo="Perguntas frequentes" />
        </div>
        <div className="border-t border-borda">
          {perguntasFrequentes(prazoCancelamentoHoras).map((f) => (
            <details key={f.pergunta} data-revelar className="faq border-b border-borda">
              <summary
                className="flex min-h-18 cursor-pointer list-none items-center justify-between gap-6 py-5
                           text-[1.0625rem] font-medium leading-snug text-texto [&::-webkit-details-marker]:hidden"
              >
                {f.pergunta}
                <span aria-hidden className="faq-icone" />
              </summary>
              <p className="pb-7 pr-4 text-texto-2 leading-relaxed md:pr-14">{f.resposta}</p>
            </details>
          ))}
        </div>
      </div>
    </Secao>
  );
}
