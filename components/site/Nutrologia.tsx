import { ClipboardList, Moon, PersonStanding, Salad } from 'lucide-react';
import { NUTROLOGIA } from '@/lib/content/site';
import { Secao, CabecalhoSecao } from '@/components/ui/Secao';

const ICONES = {
  historia: ClipboardList,
  composicao: PersonStanding,
  alimentacao: Salad,
  alem: Moon,
} as const;

/** Os quatro eixos do carrossel. Ícone ouro-escuro em círculo areia (4,1:1). */
export function Nutrologia() {
  return (
    <Secao id="nutrologia">
      <CabecalhoSecao eyebrow="Nutrologia" titulo={NUTROLOGIA.titulo} lead={NUTROLOGIA.lead} />
      <ol className="grid gap-x-12 gap-y-10 md:grid-cols-2">
        {NUTROLOGIA.eixos.map((e, i) => {
          const Icone = ICONES[e.icone];
          return (
            <li key={e.titulo} className="flex gap-5">
              <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-sand-200 text-gold-700">
                <Icone size={22} strokeWidth={1.5} />
              </span>
              <div>
                <h3 className="font-display font-semibold text-[1.3125rem] text-texto">
                  <span className="sr-only">{i + 1}. </span>{e.titulo}
                </h3>
                <p className="mt-2 text-texto-2 font-light max-w-[46ch]">{e.texto}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Secao>
  );
}
