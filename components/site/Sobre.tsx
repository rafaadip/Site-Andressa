import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PROFISSIONAL, tituloPublico } from '@/lib/config';
import { SOBRE, TRAJETORIA } from '@/lib/content/site';
import { Secao } from '@/components/ui/Secao';

/**
 * Sem foto aqui de propósito: o retrato já está no hero, e repeti-lo
 * trocaria respiro por redundância. A tipografia faz o trabalho.
 */
export function Sobre() {
  return (
    <Secao id="sobre">
      <div className="grid gap-14 lg:grid-cols-[1.15fr_.85fr] lg:gap-20">
        <div>
          <p className="eyebrow">Sobre a doutora</p>
          <h2 className="display text-h2 text-texto mt-3">{PROFISSIONAL.nome}</h2>
          <p className="mt-2 mb-7 text-acento font-medium">{tituloPublico()}</p>

          <div className="space-y-4 text-texto-2 font-light max-w-[62ch]">
            {SOBRE.paragrafos.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
          </div>

          <blockquote className="mt-9 border-l-2 border-gold-500 pl-5 font-citacao text-[1.5rem] md:text-[1.625rem] leading-snug text-texto max-w-[34ch]">
            “{SOBRE.citacao}”
          </blockquote>
        </div>

        <div>
          <h3 className="eyebrow">Trajetória</h3>
          <ol className="mt-5 border-t border-borda">
            {TRAJETORIA.map((t) => (
              <li key={t.onde} className="py-4 border-b border-borda">
                <p className="font-medium text-texto">{t.onde}</p>
                <p className="text-sm text-texto-2 tabular">{t.papel} · {t.quando}</p>
              </li>
            ))}
          </ol>
          <Link
            href="/sobre"
            className="mt-6 inline-flex min-h-11 items-center gap-2 font-medium text-acento border-b border-transparent hover:border-current"
          >
            Trajetória completa <ArrowRight aria-hidden size={16} strokeWidth={1.75} />
          </Link>
        </div>
      </div>
    </Secao>
  );
}
