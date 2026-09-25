import { ArrowRight } from 'lucide-react';
import { COMO_AGENDAR } from '@/lib/content/site';
import { linkWhatsApp, MENSAGEM_AGENDAMENTO } from '@/lib/contato';
import { Secao, CabecalhoSecao } from '@/components/ui/Secao';
import { Botao } from '@/components/ui/Botao';

export function ComoAgendar() {
  return (
    <Secao id="agendar" superficie>
      <CabecalhoSecao eyebrow="Agendamento" titulo={COMO_AGENDAR.titulo} lead={COMO_AGENDAR.lead} centralizado />

      <ol className="mx-auto grid max-w-[60rem] gap-8 md:grid-cols-3 md:gap-6">
        {COMO_AGENDAR.passos.map((p, i) => (
          <li key={p.titulo} className="flex gap-4 md:flex-col md:items-center md:text-center">
            <span
              aria-hidden
              className="grid size-11 shrink-0 place-items-center rounded-full bg-espresso-900 text-ivory-100 font-display text-[1.125rem] tabular"
            >
              {i + 1}
            </span>
            <div>
              <h3 className="font-medium text-texto">{p.titulo}</h3>
              <p className="mt-1 text-sm text-texto-2">{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-12 flex flex-col items-center gap-5">
        <Botao
          href="/agendar"
          larguraTotalMobile
          icone={<ArrowRight aria-hidden size={18} strokeWidth={1.75} />}
        >
          Agendar consulta
        </Botao>
        <p className="text-sm text-texto-2 text-center">
          Prefere conversar antes?{' '}
          <a
            href={linkWhatsApp(MENSAGEM_AGENDAMENTO)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center font-medium text-acento underline underline-offset-4"
          >
            Fale pelo WhatsApp
          </a>
        </p>
      </div>
    </Secao>
  );
}
