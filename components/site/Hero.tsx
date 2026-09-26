import Image from 'next/image';
import { Fragment, type CSSProperties } from 'react';
import { ArrowRight, BadgeCheck, Stethoscope } from 'lucide-react';
import retrato from '@/public/retratos/andressa-circular.png';
import { PROFISSIONAL } from '@/lib/config';
import { ATENDIMENTO, HERO } from '@/lib/content/site';
import { Botao } from '@/components/ui/Botao';

/**
 * Hero claro, editorial: título grande em serifa com a palavra-chave em
 * itálico oliva, retrato circular com fio oliva que se desenha, dois selos de
 * vidro flutuando sobre ele e uma aurora suave que deriva ao fundo.
 *
 * Mobile-first (docs/fases/FASE-03 §2.1): no celular o texto e os dois CTAs
 * vêm ANTES do retrato, e o "Agendar consulta" cabe inteiro acima da dobra
 * mesmo em 320×568. Quem chega pelo Instagram vê a ação sem rolar.
 *
 * Entrada (globals.css, só com prefers-reduced-motion: no-preference): as
 * palavras sobem de trás de uma máscara, o lead e os botões se abrem de
 * cima para baixo, o retrato se expande do centro e os selos se desdobram.
 * Nada usa opacidade no texto — o contraste é sempre o real, inclusive
 * durante a animação.
 *
 * Os selos repetem fatos que já estão na página (a etiqueta de modalidade
 * de ATENDIMENTO e o CRM de lib/config) — são destaque visual, por isso
 * ficam fora da árvore de acessibilidade (sem leitura duplicada).
 */
export function Hero() {
  const palavrasTitulo = HERO.titulo.split(' ');
  const palavrasDestaque = HERO.tituloDestaque.split(' ');
  const modalidades = ATENDIMENTO.modalidades.find((m) => m.modalidade === null)?.etiqueta;

  return (
    <section id="inicio" className="heroi relative overflow-clip">
      <div aria-hidden className="aurora paralaxe-aurora" />

      <div
        className="wrap relative grid items-center gap-14 pt-6 pb-28 md:gap-16 md:pt-12 md:pb-32
                   lg:grid-cols-[1.12fr_.88fr] lg:gap-12 lg:pt-10 lg:pb-36 xl:pt-14 xl:pb-40"
      >
        <div>
          <p className="eyebrow eyebrow-fio entrada-fio">
            <span>
              Atuação em Nutrologia ·{' '}
              <span className="whitespace-nowrap">{PROFISSIONAL.cidade} – {PROFISSIONAL.uf}</span>
            </span>
          </p>

          {/* Leitores de tela recebem o título inteiro pelo aria-label; as
              palavras separadas (só para a animação) ficam fora da árvore. */}
          <h1
            aria-label={`${HERO.titulo} ${HERO.tituloDestaque}`}
            className="titulo-display text-display text-texto mt-4 mb-5 md:mt-6 md:mb-7"
          >
            <span aria-hidden="true">
              <Palavras palavras={palavrasTitulo} desde={0} />{' '}
              <em className="italic text-acento">
                <Palavras palavras={palavrasDestaque} desde={palavrasTitulo.length} />
              </em>
            </span>
          </h1>

          <p className="entrada-bloco text-lead text-texto-2 max-w-[44ch] text-pretty">{HERO.lead}</p>

          <div className="entrada-cta mt-7 flex flex-col gap-3 md:mt-10 md:flex-row">
            <Botao
              href="/agendar"
              variante="primario"
              larguraTotalMobile
              icone={<ArrowRight aria-hidden size={18} strokeWidth={1.75} />}
            >
              {HERO.ctaPrimario}
            </Botao>
            <Botao href="/#sobre" variante="vidro" larguraTotalMobile>
              {HERO.ctaSecundario}
            </Botao>
          </div>
        </div>

        <figure className="paralaxe-retrato relative mx-auto w-[min(74vw,19rem)] md:w-[22rem] lg:w-[min(100%,30rem)]">
          {/* Fio oliva: um círculo que se desenha em volta do retrato. Decorativo. */}
          <svg
            aria-hidden
            viewBox="0 0 100 100"
            className="retrato-anel pointer-events-none absolute -left-[5%] -top-[5%] size-[110%] overflow-visible text-oliva-500"
          >
            <circle cx="50" cy="50" r="49.6" fill="none" stroke="currentColor" strokeWidth=".25" pathLength={1} />
          </svg>
          <Image
            src={retrato}
            alt={`${PROFISSIONAL.nome}, de jaleco branco, sorrindo`}
            // Next 16: `priority` foi descontinuado. `preload` gera o <link> e
            // `fetchPriority` sobe a prioridade da requisição — é o LCP no celular.
            preload
            fetchPriority="high"
            placeholder="blur"
            sizes="(min-width: 1024px) 480px, (min-width: 768px) 352px, 74vw"
            className="entrada-retrato relative w-full h-auto rounded-full"
          />

          <div aria-hidden className="pointer-events-none absolute inset-0">
            {modalidades && (
              <span className="selo selo-a vidro absolute left-[-9%] top-[12%] md:left-[-14%] lg:left-[-7%] lg:top-[19%]">
                <span className="selo-icone"><Stethoscope size={15} strokeWidth={1.75} /></span>
                {modalidades}
              </span>
            )}
            <span className="selo selo-b vidro absolute right-[-7%] bottom-[9%] md:right-[-10%] lg:right-[-8%] lg:bottom-[12%]">
              <span className="selo-icone"><BadgeCheck size={15} strokeWidth={1.75} /></span>
              <span className="tabular">{PROFISSIONAL.crm}</span>
            </span>
          </div>
        </figure>
      </div>
    </section>
  );
}

/** Uma palavra por máscara; `--i` escalona a subida (globals.css). */
function Palavras({ palavras, desde }: { palavras: string[]; desde: number }) {
  return palavras.map((p, i) => (
    <Fragment key={`${p}-${i}`}>
      {i > 0 && ' '}
      <span className="palavra">
        <span style={{ '--i': desde + i } as CSSProperties}>{p}</span>
      </span>
    </Fragment>
  ));
}
