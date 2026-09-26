import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import retrato from '@/public/retratos/andressa-circular.png';
import { PROFISSIONAL, tituloPublico } from '@/lib/config';
import { SOBRE, TRAJETORIA, TRAJETORIA_COMPLEMENTAR, FORMACAO, TRAJETORIA_FORMACAO } from '@/lib/content/site';
import { Secao } from '@/components/ui/Secao';
import { Botao } from '@/components/ui/Botao';
import { ListaTrajetoria } from '@/components/site/ListaTrajetoria';

export const metadata: Metadata = {
  title: 'Sobre a doutora',
  description: `Formação e trajetória de ${PROFISSIONAL.nome}, médica em ${PROFISSIONAL.cidade}–${PROFISSIONAL.uf}.`,
  alternates: { canonical: '/sobre' },
};

export default function PaginaSobre() {
  return (
    <Secao className="pt-10 md:pt-[var(--section-y)]">
      <div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr] lg:gap-24">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <figure className="relative w-[13.75rem] lg:w-80">
            <svg
              aria-hidden
              viewBox="0 0 100 100"
              className="retrato-anel pointer-events-none absolute -left-[5%] -top-[5%] size-[110%] overflow-visible text-gold-500"
            >
              <circle cx="50" cy="50" r="49.6" fill="none" stroke="currentColor" strokeWidth=".3" pathLength={1} />
            </svg>
            <Image
              src={retrato}
              alt={`${PROFISSIONAL.nome}, de jaleco branco, sorrindo`}
              placeholder="blur"
              sizes="(min-width: 1024px) 320px, 220px"
              className="relative w-full h-auto rounded-full"
            />
          </figure>
          <p className="eyebrow eyebrow-fio mt-10">Sobre a doutora</p>
          <h1 className="titulo-display text-h2 text-texto mt-4">{PROFISSIONAL.nome}</h1>
          <p className="mt-3 text-acento font-medium">{tituloPublico()}</p>
          <p className="mt-1 text-texto-2">{PROFISSIONAL.crm}</p>
        </div>

        <div>
          <div className="texto-leitura space-y-4 max-w-[62ch]">
            {SOBRE.paragrafos.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
          </div>
          <blockquote className="mt-10 mb-16 border-l border-gold-500 pl-6 font-citacao italic font-light text-[1.4375rem] leading-[1.35] text-texto max-w-[32ch] md:text-[1.625rem]">
            “{SOBRE.citacao}”
          </blockquote>

          <ListaTrajetoria titulo="Formação" itens={FORMACAO} />
          <ListaTrajetoria titulo="Atuação" itens={[...TRAJETORIA, ...TRAJETORIA_COMPLEMENTAR]} />
          <ListaTrajetoria titulo="Internato e atividades acadêmicas" itens={TRAJETORIA_FORMACAO} />

          <div className="mt-16">
            <Botao
              href="/agendar"
              variante="primario"
              larguraTotalMobile
              icone={<ArrowRight aria-hidden size={18} strokeWidth={1.75} />}
            >
              Agendar consulta
            </Botao>
          </div>
        </div>
      </div>
    </Secao>
  );
}
