import type { Metadata } from 'next';
import Image from 'next/image';
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
    <Secao>
      <div className="grid gap-14 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Image
            src={retrato}
            alt={`${PROFISSIONAL.nome}, de jaleco branco, sorrindo`}
            placeholder="blur"
            sizes="(min-width: 1024px) 320px, 220px"
            className="w-[13.75rem] lg:w-80 h-auto rounded-full"
          />
          <p className="eyebrow mt-8">Sobre a doutora</p>
          <h1 className="display text-h2 text-texto mt-3">{PROFISSIONAL.nome}</h1>
          <p className="mt-2 text-acento font-medium">{tituloPublico()}</p>
          <p className="mt-1 text-texto-2">{PROFISSIONAL.crm}</p>
        </div>

        <div>
          <div className="space-y-4 text-texto-2 font-light max-w-[62ch]">
            {SOBRE.paragrafos.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}
          </div>
          <blockquote className="mt-9 mb-14 border-l-2 border-gold-500 pl-5 font-citacao text-[1.5rem] leading-snug text-texto max-w-[34ch]">
            “{SOBRE.citacao}”
          </blockquote>

          <ListaTrajetoria titulo="Formação" itens={FORMACAO} />
          <ListaTrajetoria titulo="Atuação" itens={[...TRAJETORIA, ...TRAJETORIA_COMPLEMENTAR]} />
          <ListaTrajetoria titulo="Internato e atividades acadêmicas" itens={TRAJETORIA_FORMACAO} />

          <div className="mt-14">
            <Botao href="/agendar" larguraTotalMobile>Agendar consulta</Botao>
          </div>
        </div>
      </div>
    </Secao>
  );
}
