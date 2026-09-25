import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import retrato from '@/public/retratos/andressa-circular.png';
import { PROFISSIONAL } from '@/lib/config';
import { HERO } from '@/lib/content/site';
import { Botao } from '@/components/ui/Botao';

/**
 * Bloco espresso no topo — a assinatura visual do carrossel.
 *
 * Mobile-first (docs/fases/FASE-03 §2.1): no celular o texto e os dois CTAs
 * vêm ANTES do retrato, para que "Agendar consulta" fique acima da dobra em
 * 375px. Quem chega pelo Instagram precisa ver a ação sem rolar.
 */
export function Hero() {
  return (
    <section id="inicio" className="superficie-escura relative overflow-hidden">
      <div
        className="wrap grid items-center gap-12 lg:grid-cols-[1.1fr_.9fr] lg:gap-16
                   pt-12 pb-16 md:pt-16 md:pb-20 lg:py-24"
      >
        <div>
          <p className="eyebrow">
            Atuação em Nutrologia ·{' '}
            <span className="whitespace-nowrap">{PROFISSIONAL.cidade} – {PROFISSIONAL.uf}</span>
          </p>
          <h1 className="display text-display text-texto mt-5 mb-6 text-balance">
            {HERO.titulo}{' '}
            <em className="italic font-medium text-acento">{HERO.tituloDestaque}</em>
          </h1>
          <p className="text-lead font-light text-texto-2 max-w-[46ch]">{HERO.lead}</p>

          <div className="mt-9 flex flex-col gap-3 md:flex-row md:gap-4">
            <Botao
              href="/agendar"
              larguraTotalMobile
              icone={<ArrowRight aria-hidden size={18} strokeWidth={1.75} />}
            >
              {HERO.ctaPrimario}
            </Botao>
            <Botao href="/#sobre" variante="fantasma" larguraTotalMobile>
              {HERO.ctaSecundario}
            </Botao>
          </div>
        </div>

        <figure className="relative mx-auto w-[min(76vw,18.5rem)] md:w-[21rem] lg:w-[26rem]">
          {/* Fio ouro deslocado — detalhe herdado do protótipo. Decorativo. */}
          <span
            aria-hidden
            className="absolute inset-0 translate-x-3 translate-y-3 rounded-full border border-gold-500/70"
          />
          <Image
            src={retrato}
            alt={`${PROFISSIONAL.nome}, de jaleco branco, sorrindo`}
            // Next 16: `priority` foi descontinuado. `preload` gera o <link> e
            // `fetchPriority` sobe a prioridade da requisição — é o LCP no celular.
            preload
            fetchPriority="high"
            placeholder="blur"
            sizes="(min-width: 1024px) 416px, (min-width: 768px) 336px, 76vw"
            className="relative w-full h-auto rounded-full"
          />
        </figure>
      </div>
    </section>
  );
}
