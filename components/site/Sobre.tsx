import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PROFISSIONAL, tituloPublico } from '@/lib/config';
import { SOBRE, TRAJETORIA } from '@/lib/content/site';
import { Secao } from '@/components/ui/Secao';

/**
 * Sem foto aqui de propósito: o retrato já está no hero, e repeti-lo
 * trocaria respiro por redundância. A tipografia faz o trabalho — nome em
 * serifa grande, citação em Fraunces itálico e a trajetória como linha do tempo.
 */
export function Sobre() {
  return (
    <Secao id="sobre">
      <div className="grid gap-14 lg:grid-cols-[1.2fr_.8fr] lg:gap-24">
        <div>
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
            className="mt-10 border-l border-oliva-500 pl-6 font-citacao italic font-light text-[1.4375rem] leading-[1.35] text-texto max-w-[32ch] md:text-[1.625rem] lg:mt-12 lg:text-[1.875rem]"
          >
            “{SOBRE.citacao}”
          </blockquote>
        </div>

        <div data-revelar className="lg:pt-2">
          <h3 className="eyebrow">Trajetória</h3>
          <ol className="linha-tempo mt-4">
            {TRAJETORIA.map((t) => (
              <li key={t.onde} className="py-4">
                <p className="font-medium text-texto">{t.onde}</p>
                <p className="mt-0.5 text-sm text-texto-2 tabular">{t.papel} · {t.quando}</p>
              </li>
            ))}
          </ol>
          <Link
            href="/sobre"
            className="link-fio mt-6 inline-flex min-h-11 items-center gap-2 font-medium text-acento"
          >
            Trajetória completa <ArrowRight aria-hidden size={16} strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </Secao>
  );
}
