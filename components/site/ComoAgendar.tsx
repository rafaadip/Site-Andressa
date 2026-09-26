import type { CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import { COMO_AGENDAR } from '@/lib/content/site';
import { linkWhatsApp, MENSAGEM_AGENDAMENTO } from '@/lib/contato';
import { Secao, CabecalhoSecao } from '@/components/ui/Secao';
import { Botao } from '@/components/ui/Botao';

/**
 * O ponto de conversão da página: um painel claro, centrado, com os três
 * passos ligados por um fio (horizontal no desktop, vertical no celular).
 */
export function ComoAgendar() {
  return (
    <Secao id="agendar" superficie className="secao-aurora">
      <div
        data-revelar
        className="vidro rounded-[1.75rem] px-6 py-12 md:rounded-[2.25rem] md:px-12 md:py-16 lg:px-20 lg:py-20"
      >
        <CabecalhoSecao eyebrow="Agendamento" titulo={COMO_AGENDAR.titulo} lead={COMO_AGENDAR.lead} centralizado revelar={false} />

        <div className="relative mx-auto max-w-[58rem]">
          {/* Fio que liga os passos (fora da <ol>: lista só contém <li>). Decorativo. */}
          <span
            aria-hidden
            className="passos-fio absolute left-6 top-6 bottom-6 w-px origin-top bg-oliva-500/45
                       md:inset-x-[16.66%] md:bottom-auto md:h-px md:w-auto md:origin-left"
          />
          <ol className="relative grid gap-9 md:grid-cols-3 md:gap-8">
            {COMO_AGENDAR.passos.map((p, i) => (
              <li key={p.titulo} className="flex gap-5 md:flex-col md:items-center md:text-center">
                <span
                  aria-hidden
                  style={{ '--i': i } as CSSProperties}
                  className="passo-numero grid size-12 shrink-0 place-items-center rounded-full bg-floresta-900 font-display text-[1.1875rem] text-ivory-100 tabular
                             shadow-[0_10px_24px_-10px_rgb(29_42_31/.55)]"
                >
                  {i + 1}
                </span>
                <div className="pt-2.5 md:pt-0">
                  <h3 className="font-medium text-[1.0625rem] text-texto md:mt-5">{p.titulo}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-texto-2 md:mx-auto md:max-w-[24ch]">{p.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 md:mt-14">
          <Botao
            href="/agendar"
            variante="primario"
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
              className="link-fio inline-flex min-h-11 items-center font-medium text-acento"
            >
              Fale pelo WhatsApp
            </a>
          </p>
        </div>
      </div>
    </Secao>
  );
}
