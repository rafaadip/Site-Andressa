import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PROFISSIONAL, tituloPublico } from '@/lib/config';
import { SOBRE } from '@/lib/content/site';
import { Secao } from '@/components/ui/Secao';

/**
 * Sem foto aqui de propósito: o retrato já está no hero, e repeti-lo
 * trocaria respiro por redundância. A tipografia faz o trabalho — nome em
 * serifa grande e citação em Fraunces itálico. A trajetória fica em /sobre.
 */
export function Sobre() {
  return (
    <Secao id="sobre">
      <div data-revelar="titulo">
        <p className="eyebrow eyebrow-fio">Sobre a doutora</p>
        <h2 className="titulo-display titulo-mascara text-h2 text-texto mt-4">{PROFISSIONAL.nome}</h2>
        <p className="titulo-lead mt-3 font-medium text-acento">{tituloPublico()}</p>
      </div>

      <div data-revelar className="texto-leitura mt-8 space-y-4 max-w-[60ch]">
        {SOBRE.paragrafos.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
      </div>

      <blockquote
        data-revelar
        className="mt-10 border-l border-gold-500 pl-6 font-citacao italic font-light text-[1.4375rem] leading-[1.35] text-texto max-w-[32ch] md:text-[1.625rem] lg:mt-12 lg:text-[1.875rem]"
      >
        “{SOBRE.citacao}”
      </blockquote>

      <Link
        href="/sobre"
        className="link-fio mt-10 inline-flex min-h-11 items-center gap-2 font-medium text-acento"
      >
        {SOBRE.linkMais} <ArrowRight aria-hidden size={16} strokeWidth={1.75} />
      </Link>
    </Secao>
  );
}
