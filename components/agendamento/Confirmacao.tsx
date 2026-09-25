import { forwardRef, useState } from 'react';
import { CalendarPlus, Check, Copy, MessageCircle } from 'lucide-react';
import type { AgendamentoConfirmado } from '@/lib/agendamento/tipos';
import { PROFISSIONAL } from '@/lib/config';
import { linkWhatsApp } from '@/lib/contato';
import { Botao } from '@/components/ui/Botao';

type Props = { ag: AgendamentoConfirmado; nome: string };

/**
 * O paciente sai daqui com o compromisso NA MÃO, sem depender de e-mail:
 * os botões de calendário funcionam na hora (FASE-06 §3.4).
 * Sem confete, sem animação exagerada: é uma consulta médica.
 */
export const Confirmacao = forwardRef<HTMLHeadingElement, Props>(function Confirmacao({ ag, nome }, tituloRef) {
  const [copiado, setCopiado] = useState(false);
  const primeiroNome = nome.trim().split(/\s+/)[0] ?? '';

  async function copiar() {
    try {
      await navigator.clipboard.writeText(ag.urlGestao);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 4000);
    } catch { /* sem permissão: o link continua visível para copiar à mão */ }
  }

  const mensagem =
    `Olá, ${PROFISSIONAL.nomeCurto}! Acabei de agendar pelo site:\n\n`
    + `• ${ag.tipo}\n• ${ag.quando}\n• Nome: ${nome.trim()}`;

  return (
    <div>
      <div className="text-center">
        <span aria-hidden className="mx-auto grid size-14 place-items-center rounded-full bg-success text-ivory-50">
          <Check size={28} strokeWidth={2.25} />
        </span>
        <h2 ref={tituloRef} tabIndex={-1} className="display text-h3 text-texto mt-5 outline-none">
          Consulta confirmada{primeiroNome && <>, {primeiroNome}</>}
        </h2>
        <p className="mt-3 text-lead text-texto first-letter:uppercase">{ag.quando}</p>
        <p className="mt-1 text-texto-2">{ag.tipo} · {ag.local}</p>
      </div>

      <section aria-labelledby="titulo-calendario" className="mt-9 rounded-lg border border-borda bg-superficie p-5 md:p-6">
        <h3 id="titulo-calendario" className="flex items-center gap-2 font-medium text-texto">
          <CalendarPlus aria-hidden size={20} strokeWidth={1.5} className="text-acento" />
          Adicione ao seu calendário
        </h3>
        <div className="mt-4 flex flex-col gap-3 md:flex-row">
          <Botao href={ag.urlGoogle} variante="contorno" larguraTotalMobile>Google Agenda</Botao>
          {/* Mesma aba e sem `download`: no iPhone, o Safari abre direto o
              "Adicionar ao Calendário" em vez de salvar em Arquivos. */}
          <Botao href={ag.urlIcs} variante="contorno" larguraTotalMobile nativo>
            iPhone, Outlook e outros
          </Botao>
        </div>
        <p className="mt-3 text-sm text-texto-2">O evento já inclui o link para cancelar, se precisar.</p>
      </section>

      <section aria-labelledby="titulo-link" className="mt-5">
        <h3 id="titulo-link" className="font-medium text-texto">Link da sua consulta</h3>
        <p className="mt-1 text-sm text-texto-2">Guarde-o: é por ele que você cancela, até 24 horas antes.</p>
        <div className="mt-3 flex gap-2">
          <input
            readOnly
            value={ag.urlGestao}
            aria-label="Link da sua consulta"
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-12 min-w-0 flex-1 truncate rounded-md border border-borda-campo bg-elevado px-3 text-sm text-texto"
          />
          <button
            type="button"
            onClick={copiar}
            className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border border-borda-campo px-4 font-medium text-texto"
          >
            {copiado ? <Check aria-hidden size={18} /> : <Copy aria-hidden size={18} strokeWidth={1.75} />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <p role="status" className="sr-only">{copiado ? 'Link copiado.' : ''}</p>
      </section>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Botao
          href={linkWhatsApp(mensagem)}
          larguraTotalMobile
          icone={<MessageCircle aria-hidden size={18} strokeWidth={1.75} />}
        >
          Avisar pelo WhatsApp
        </Botao>
        <Botao href="/" variante="contorno" larguraTotalMobile>Voltar ao início</Botao>
      </div>
    </div>
  );
});
