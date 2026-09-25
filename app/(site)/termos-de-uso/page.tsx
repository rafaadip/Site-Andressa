import type { Metadata } from 'next';
import Link from 'next/link';
import { PROFISSIONAL } from '@/lib/config';
import { URGENCIA } from '@/lib/content/site';
import { Secao } from '@/components/ui/Secao';
import { prazoCancelamentoPublico } from '@/lib/agendamento/servico';

export const metadata: Metadata = {
  title: 'Termos de uso',
  alternates: { canonical: '/termos-de-uso' },
};

/** ⚠️ REVISÃO JURÍDICA OBRIGATÓRIA antes do go-live (FASE-13). */
const ATUALIZADO_EM = '25 de setembro de 2026';

export default async function TermosDeUso() {
  const prazo = await prazoCancelamentoPublico();
  return (
    <Secao>
      <article className="prosa mx-auto">
        <p className="eyebrow">Termos</p>
        <h1 className="display text-h2 text-texto mt-3">Termos de uso</h1>
        <p className="text-sm">Última atualização: {ATUALIZADO_EM}</p>

        <h2>Sobre este site</h2>
        <p>
          Este é o site profissional de {PROFISSIONAL.nome} ({PROFISSIONAL.crm}). As
          informações publicadas aqui têm caráter informativo e <strong>não substituem
          uma consulta médica</strong>.
        </p>

        <h2>Urgência e emergência</h2>
        <p>
          <strong>{URGENCIA.titulo}</strong> {URGENCIA.texto} <strong>{URGENCIA.telefone}</strong>.
          Mensagens enviadas pelo site, e-mail ou WhatsApp não são monitoradas em tempo real.
        </p>

        <h2>Agendamento</h2>
        <ul>
          <li>O horário só está garantido após a confirmação.</li>
          <li>Cancelamentos podem ser feitos pelo link da sua consulta (mostrado ao confirmar e salvo no evento do calendário) até {prazo} horas antes. Depois disso, fale pelo WhatsApp.</li>
          <li>Informe dados corretos: são eles que permitem confirmar e lembrar a sua consulta.</li>
        </ul>

        <h2>Teleconsulta</h2>
        <p>
          As teleconsultas seguem a regulamentação do Conselho Federal de Medicina para
          telemedicina. Se a avaliação indicar necessidade de exame físico, você será
          orientado(a) a realizar consulta presencial.
        </p>

        <h2>Privacidade</h2>
        <p>
          O tratamento dos seus dados está descrito na{' '}
          <Link href="/politica-de-privacidade">política de privacidade</Link>.
        </p>
      </article>
    </Secao>
  );
}
