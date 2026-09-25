import type { Metadata } from 'next';
import { Mail, MessageCircle, TriangleAlert } from 'lucide-react';
import { PROFISSIONAL, localConsulta } from '@/lib/config';
import { linkWhatsApp, MENSAGEM_AGENDAMENTO } from '@/lib/contato';
import { URGENCIA } from '@/lib/content/site';
import { Secao, CabecalhoSecao } from '@/components/ui/Secao';
import { Botao } from '@/components/ui/Botao';

export const metadata: Metadata = {
  title: 'Agendar consulta',
  description: `Agende uma consulta presencial em ${PROFISSIONAL.cidade}–${PROFISSIONAL.uf} ou por teleconsulta.`,
  alternates: { canonical: '/agendar' },
};

/**
 * PROVISÓRIA — substituída pelo fluxo de 4 etapas da FASE-07.
 *
 * Existe para que todo CTA do site já leve a um caminho que FUNCIONA hoje,
 * em vez de um "em breve" sem saída. Cada fase entrega um site publicável.
 */
export default function PaginaAgendar() {
  return (
    <Secao>
      <div className="mx-auto max-w-[40rem]">
        <CabecalhoSecao
          nivel="h1"
          eyebrow="Agendamento"
          titulo="Agende sua consulta"
          lead="O agendamento online, com escolha de horário e confirmação direto no calendário, está em implantação. Enquanto isso, agende pelo WhatsApp ou por e-mail."
        />

        <div className="flex flex-col gap-3 md:flex-row">
          <Botao
            href={linkWhatsApp(MENSAGEM_AGENDAMENTO)}
            larguraTotalMobile
            icone={<MessageCircle aria-hidden size={18} strokeWidth={1.75} />}
          >
            Agendar pelo WhatsApp
          </Botao>
          <Botao
            href={`mailto:${PROFISSIONAL.email}?subject=${encodeURIComponent('Agendamento de consulta')}`}
            variante="contorno"
            larguraTotalMobile
            icone={<Mail aria-hidden size={18} strokeWidth={1.75} />}
          >
            Enviar e-mail
          </Botao>
        </div>

        <dl className="mt-12 border-t border-borda">
          <div className="py-5 border-b border-borda">
            <dt className="eyebrow">Presencial</dt>
            <dd className="mt-1 text-texto">{localConsulta('in_person')}</dd>
          </div>
          <div className="py-5 border-b border-borda">
            <dt className="eyebrow">Teleconsulta</dt>
            <dd className="mt-1 text-texto">{localConsulta('telehealth')}</dd>
          </div>
        </dl>

        <aside className="mt-12 flex gap-4 rounded-lg border border-borda bg-superficie p-6">
          <TriangleAlert aria-hidden size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-danger" />
          <p className="text-texto-2">
            <strong className="font-medium text-texto">{URGENCIA.titulo}</strong>{' '}
            {URGENCIA.texto} <strong className="text-texto">{URGENCIA.telefone}</strong>.
          </p>
        </aside>
      </div>
    </Secao>
  );
}
