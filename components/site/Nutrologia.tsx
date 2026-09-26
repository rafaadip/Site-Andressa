import { ClipboardList, Moon, PersonStanding, Salad } from 'lucide-react';
import { NUTROLOGIA } from '@/lib/content/site';
import { Secao, CabecalhoSecao } from '@/components/ui/Secao';

const ICONES = {
  historia: ClipboardList,
  composicao: PersonStanding,
  alimentacao: Salad,
  alem: Moon,
} as const;

/**
 * Os quatro eixos do carrossel, lidos como uma sequência editorial:
 * número em itálico ouro, ícone em círculo areia e um fio que se
 * desenha ao entrar na tela. 1 coluna no celular · 2 no tablet · 4 no desktop.
 */
export function Nutrologia() {
  return (
    <Secao id="nutrologia">
      <CabecalhoSecao eyebrow="Nutrologia" titulo={NUTROLOGIA.titulo} lead={NUTROLOGIA.lead} lado />
      <ol className="grid gap-x-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-x-10">
        {NUTROLOGIA.eixos.map((e, i) => {
          const Icone = ICONES[e.icone];
          return (
            <li key={e.titulo} data-revelar className="group traco-topo pt-6 pb-10 lg:pb-0">
              <div className="flex items-center justify-between">
                <span aria-hidden className="font-display italic text-[1.75rem] leading-none text-acento tabular transition-transform duration-500 group-hover:translate-x-1">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  aria-hidden
                  className="grid size-11 place-items-center rounded-full bg-sand-200 text-gold-700 transition-[background-color,color,rotate] duration-500
                             group-hover:-rotate-6 group-hover:bg-espresso-900 group-hover:text-gold-200"
                >
                  <Icone size={20} strokeWidth={1.5} />
                </span>
              </div>
              <h3 className="titulo-display mt-7 text-[1.4375rem] text-texto">
                <span className="sr-only">{i + 1}. </span>{e.titulo}
              </h3>
              <p className="mt-3 text-texto-2 leading-relaxed max-w-[42ch]">{e.texto}</p>
            </li>
          );
        })}
      </ol>
    </Secao>
  );
}
