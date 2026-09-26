import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CalendarX, MessageCircle, Video } from 'lucide-react';
import { buscarPorToken, dadosIcs } from '@/lib/agendamento/servico';
import { linkGoogleCalendar } from '@/lib/calendar/ics';
import { linkWhatsApp } from '@/lib/contato';
import { PROFISSIONAL } from '@/lib/config';
import { urlSite } from '@/lib/seo';
import { Secao } from '@/components/ui/Secao';
import { Botao } from '@/components/ui/Botao';
import { BotaoCancelar } from './BotaoCancelar';
import { BotaoApagarMotivo } from './BotaoApagarMotivo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sua consulta',
  robots: { index: false, follow: false },
  // O token está na URL: sem isto, clicar em WhatsApp/Google a partir
  // daqui mandaria o link de gestão no cabeçalho Referer.
  referrer: 'no-referrer',
};

export default async function PaginaConsulta({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const g = await buscarPorToken(token).catch(() => null);
  if (!g) notFound();

  const cancelada = g.linha.status === 'cancelled';
  const futura = g.linha.visitStartsAt > new Date();
  const urlIcs = `/api/ics?t=${token}`;
  const urlGoogle = linkGoogleCalendar(dadosIcs(g.linha, g.tipoLabel, g.modalidade, `${urlSite()}/consulta/${token}`));
  const msgWhats = `Olá, ${PROFISSIONAL.nomeCurto}! Sobre minha consulta de ${g.quando} (${g.linha.patientName}):`;

  return (
    <Secao className="pt-8 md:pt-[var(--section-y)]">
      <div className="mx-auto max-w-[40rem]">
        <p className="eyebrow eyebrow-fio">Sua consulta</p>
        <h1 className="titulo-display text-h2 text-texto mt-4">
          {cancelada ? 'Consulta cancelada' : 'Consulta confirmada'}
        </h1>

        <dl className="mt-8 border-t border-borda">
          {[
            ['Quando', g.quando],
            ['Tipo', g.tipoLabel],
            ['Local', g.local],
            ['Paciente', g.linha.patientName],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="grid gap-1 border-b border-borda py-4 md:grid-cols-[8rem_1fr]">
              <dt className="eyebrow md:pt-1">{rotulo}</dt>
              <dd className={`text-texto first-letter:uppercase ${cancelada && rotulo === 'Quando' ? 'line-through decoration-texto-2' : ''}`}>{valor}</dd>
            </div>
          ))}
        </dl>

        {cancelada ? (
          <section className="mt-10 space-y-6">
            <div className="rounded-lg border border-borda bg-superficie p-5">
              <h2 className="flex items-center gap-2 font-medium text-texto">
                <CalendarX aria-hidden size={20} strokeWidth={1.5} className="text-acento" />
                Tire do seu calendário
              </h2>
              <p className="mt-1 text-sm text-texto-2">
                No iPhone e no Outlook, abrir o arquivo abaixo remove o evento automaticamente.
              </p>
              <div className="mt-4">
                <Botao href={urlIcs} variante="contorno" nativo larguraTotalMobile>Remover do calendário</Botao>
              </div>
            </div>
            <Botao href="/agendar" larguraTotalMobile>Agendar outro horário</Botao>
          </section>
        ) : (
          <section className="mt-10 space-y-8">
            {g.telehealthUrl && futura && (
              <div className="rounded-lg border border-borda bg-superficie p-5">
                <h2 className="flex items-center gap-2 font-medium text-texto">
                  <Video aria-hidden size={20} strokeWidth={1.5} className="text-acento" />
                  Link da teleconsulta
                </h2>
                <p className="mt-1 mb-4 text-sm text-texto-2">Entre alguns minutos antes, de um lugar reservado e com boa conexão.</p>
                <Botao href={g.telehealthUrl} larguraTotalMobile>Entrar na teleconsulta</Botao>
              </div>
            )}

            <div className="flex flex-col gap-3 md:flex-row">
              <Botao href={urlGoogle} variante="contorno" larguraTotalMobile>Google Agenda</Botao>
              <Botao href={urlIcs} variante="contorno" nativo larguraTotalMobile>iPhone, Outlook e outros</Botao>
            </div>

            <div className="border-t border-borda pt-8">
              <h2 className="font-medium text-texto">Precisa desmarcar?</h2>
              {g.podeCancelar ? (
                <>
                  <p className="mt-1 mb-4 text-sm text-texto-2">
                    Pelo link, até {g.prazoCancelamentoHoras} horas antes. Para trocar de horário, cancele e agende outro.
                  </p>
                  <BotaoCancelar token={token} quando={g.quando} />
                </>
              ) : (
                <>
                  <p className="mt-1 mb-4 text-sm text-texto-2">
                    {futura
                      ? `Faltam menos de ${g.prazoCancelamentoHoras} horas. Para cancelar ou remarcar, fale pelo WhatsApp.`
                      : 'Para falar sobre esta consulta, use o WhatsApp.'}
                  </p>
                  <Botao href={linkWhatsApp(msgWhats)} larguraTotalMobile
                    icone={<MessageCircle aria-hidden size={18} strokeWidth={1.75} />}>
                    Falar pelo WhatsApp
                  </Botao>
                </>
              )}
            </div>
          </section>
        )}

        {g.linha.patientNote && (
          <section aria-labelledby="titulo-motivo" className="mt-10 border-t border-borda pt-8">
            <h2 id="titulo-motivo" className="font-medium text-texto">Motivo da consulta</h2>
            <p className="mt-1 mb-4 text-sm text-texto-2">
              Você informou um motivo, que é informação de saúde. Ele é apagado
              automaticamente 90 dias depois da consulta — ou agora, se preferir.
            </p>
            <BotaoApagarMotivo token={token} />
          </section>
        )}
      </div>
    </Secao>
  );
}
