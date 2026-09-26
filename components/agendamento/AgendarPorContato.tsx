import { Mail, MessageCircle } from 'lucide-react';
import { PROFISSIONAL, localConsulta } from '@/lib/config';
import { linkWhatsApp, MENSAGEM_AGENDAMENTO } from '@/lib/contato';
import { Botao } from '@/components/ui/Botao';

/**
 * Plano B do /agendar: banco fora do ar, nenhum tipo cadastrado, ou produção
 * sem Google e sem opt-in (AGENDAMENTO_SEM_GOOGLE). O paciente nunca fica
 * sem caminho para marcar.
 */
export function AgendarPorContato() {
  return (
    <>
      <p className="text-lead text-texto-2 mb-8">
        Agende pelo WhatsApp ou por e-mail — respondemos para combinar o melhor horário.
      </p>
      <div className="flex flex-col gap-3 md:flex-row">
        <Botao href={linkWhatsApp(MENSAGEM_AGENDAMENTO)} larguraTotalMobile
          icone={<MessageCircle aria-hidden size={18} strokeWidth={1.75} />}>
          Agendar pelo WhatsApp
        </Botao>
        <Botao href={`mailto:${PROFISSIONAL.email}?subject=${encodeURIComponent('Agendamento de consulta')}`}
          variante="contorno" larguraTotalMobile icone={<Mail aria-hidden size={18} strokeWidth={1.75} />}>
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
    </>
  );
}
