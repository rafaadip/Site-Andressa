import type { Metadata } from 'next';
import { PROFISSIONAL } from '@/lib/config';
import { Secao } from '@/components/ui/Secao';

export const metadata: Metadata = {
  title: 'Política de privacidade',
  alternates: { canonical: '/politica-de-privacidade' },
};

/**
 * ⚠️ REVISÃO JURÍDICA OBRIGATÓRIA antes do go-live (FASE-10 §3.6 e FASE-13).
 * Texto redigido para refletir o sistema como projetado; confirmar operadores
 * e prazos no momento da publicação.
 */
const ATUALIZADO_EM = '25 de setembro de 2026';

export default function PoliticaPrivacidade() {
  return (
    <Secao>
      <article className="prosa mx-auto">
        <p className="eyebrow">Privacidade</p>
        <h1 className="display text-h2 text-texto mt-3">Política de privacidade</h1>
        <p className="text-sm">Última atualização: {ATUALIZADO_EM}</p>

        <p>
          Esta página explica, em linguagem simples, quais dados este site coleta,
          por quê, com quem eles são compartilhados e como você pode exercer os seus
          direitos, nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
        </p>

        <h2>Quem é a responsável pelos seus dados</h2>
        <p>
          <strong>{PROFISSIONAL.nome}</strong>, {PROFISSIONAL.crm}, com atendimento em{' '}
          {PROFISSIONAL.cidade} – {PROFISSIONAL.uf}. Contato para assuntos de privacidade:{' '}
          <a href={`mailto:${PROFISSIONAL.email}?subject=Privacidade`}>{PROFISSIONAL.email}</a>.
        </p>

        <h2>Quais dados coletamos e para quê</h2>
        <p>Coletamos apenas o necessário para marcar e confirmar a sua consulta:</p>
        <div className="tabela">
          <table>
            <thead>
              <tr><th scope="col">Dado</th><th scope="col">Para quê</th><th scope="col">Por quanto tempo</th></tr>
            </thead>
            <tbody>
              <tr><td>Nome, e-mail e telefone</td><td>Agendar, confirmar e lembrar a consulta</td><td>5 anos</td></tr>
              <tr><td>Data e horário da consulta</td><td>Organizar a agenda</td><td>5 anos</td></tr>
              <tr><td>Motivo da consulta <em>(opcional)</em></td><td>Permitir que a médica se prepare</td><td><strong>90 dias</strong></td></tr>
              <tr><td>Registro do seu consentimento</td><td>Comprovar que você autorizou o uso dos dados</td><td>5 anos</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          <strong>Não coletamos</strong> CPF, data de nascimento, endereço, convênio, peso,
          altura, fotos ou exames. Este site não é prontuário médico: informações clínicas
          são tratadas apenas na consulta.
        </p>

        <h2>O motivo da consulta é informação de saúde</h2>
        <p>
          Se você escrever o motivo da consulta, estará compartilhando um <strong>dado
          pessoal sensível</strong>. Por isso o campo é opcional e só é registrado com o
          seu consentimento específico, pedido em separado no formulário. Ele é apagado
          automaticamente 90 dias após a consulta, e você pode pedir a exclusão antes.
        </p>

        <h2>Com quem compartilhamos</h2>
        <p>Não vendemos nem cedemos seus dados. Eles são processados apenas pelos serviços que fazem o site funcionar:</p>
        <ul>
          <li><strong>Google</strong> (Google Agenda) — para registrar a consulta na agenda da médica.</li>
          <li><strong>Resend</strong> — para enviar os e-mails de confirmação e lembrete.</li>
          <li><strong>Supabase</strong> — banco de dados onde o agendamento fica guardado, com servidores em São Paulo.</li>
          <li><strong>Vercel</strong> — hospedagem do site.</li>
        </ul>
        <p>
          Alguns desses serviços podem processar dados fora do Brasil. Nesses casos, a
          transferência segue as salvaguardas contratuais previstas na LGPD.
        </p>

        <h2>Cookies</h2>
        <p>
          Este site <strong>não usa cookies de rastreamento nem de publicidade</strong>.
          As estatísticas de visita são anônimas e agregadas, sem identificar você — por
          isso não exibimos aviso de cookies.
        </p>

        <h2>Seus direitos</h2>
        <p>Você pode, a qualquer momento:</p>
        <ul>
          <li>confirmar se tratamos seus dados e acessá-los;</li>
          <li>corrigir dados incompletos ou desatualizados;</li>
          <li>pedir a exclusão dos seus dados;</li>
          <li>revogar o consentimento para o motivo da consulta — ele é apagado na hora;</li>
          <li>receber seus dados em formato digital (portabilidade).</li>
        </ul>
        <p>
          Para isso, escreva para{' '}
          <a href={`mailto:${PROFISSIONAL.email}?subject=Direitos%20do%20titular`}>{PROFISSIONAL.email}</a>.
          Respondemos em até 15 dias. Você também pode recorrer à Autoridade Nacional de
          Proteção de Dados (ANPD).
        </p>

        <h2>Segurança</h2>
        <p>
          Os dados trafegam por conexão criptografada (HTTPS). O acesso à agenda é
          restrito à médica. Credenciais de integração são guardadas criptografadas.
        </p>
      </article>
    </Secao>
  );
}
