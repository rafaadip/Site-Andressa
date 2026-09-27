'use client';

import { useActionState, useState } from 'react';
import { Mail, MessageCircle, Phone } from 'lucide-react';
import { acaoApagarContato, acaoContatoAtendido, type Estado } from '@/app/admin/(painel)/acoes';
import { BotaoEnviar } from './BotaoEnviar';
import { Resultado } from './Resultado';

export type ContatoParaCartao = {
  id: string;
  nome: string;
  idade: number;
  email: string;
  telefone: string | null;
  whatsapp: string | null;
  horario: string | null;
  motivo: string;
  recebidoEm: string;
  atendido: boolean;
};

/**
 * Um pedido de contato no painel: dados, atalhos de retorno (WhatsApp,
 * ligação, e-mail), "marcar como retornado" e apagar — este em 2 etapas,
 * porque não tem volta (mesmo padrão do motivo e do cancelamento, UX-05).
 */
export function CartaoContato({ c }: { c: ContatoParaCartao }) {
  const [estadoAtendido, acaoAtendido] = useActionState<Estado, FormData>(acaoContatoAtendido, null);
  const [estadoApagar, acaoApagar] = useActionState<Estado, FormData>(acaoApagarContato, null);
  const [confirmando, setConfirmando] = useState(false);
  const idTitulo = `contato-${c.id}`;

  return (
    <article aria-labelledby={idTitulo} className="rounded-lg border border-borda bg-elevado p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={idTitulo} className="font-medium text-texto">{c.nome} · {c.idade} {c.idade === 1 ? 'ano' : 'anos'}</h3>
          <p className="text-sm text-texto-2 first-letter:uppercase">Recebido {c.recebidoEm}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${c.atendido ? 'bg-superficie text-texto-2' : 'bg-espresso-900 text-ivory-100'}`}>
          {c.atendido ? 'Retornado' : 'Pendente'}
        </span>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
        <div><dt className="inline text-texto-2">Motivo: </dt><dd className="inline text-texto">{c.motivo}</dd></div>
        <div><dt className="inline text-texto-2">Horário: </dt><dd className="inline text-texto">{c.horario ?? 'sem preferência'}</dd></div>
      </dl>

      <ul className="mt-3 flex flex-wrap gap-2">
        {c.whatsapp && (
          <li>
            <a href={c.whatsapp} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-borda-campo px-4 text-sm text-texto">
              <MessageCircle aria-hidden size={16} />WhatsApp {c.telefone}
            </a>
          </li>
        )}
        {c.telefone && (
          <li>
            <a href={`tel:${c.telefone.replace(/\D/g, '')}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-borda-campo px-4 text-sm text-texto">
              <Phone aria-hidden size={16} />Ligar
            </a>
          </li>
        )}
        <li>
          <a href={`mailto:${c.email}`}
            className="inline-flex min-h-11 items-center gap-2 break-all rounded-full border border-borda-campo px-4 text-sm text-texto">
            <Mail aria-hidden size={16} />{c.email}
          </a>
        </li>
      </ul>

      <div className="mt-4 flex flex-col gap-2 border-t border-borda pt-4 md:flex-row md:items-start">
        <form action={acaoAtendido}>
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="atendido" value={c.atendido ? '0' : '1'} />
          <BotaoEnviar variante={c.atendido ? 'contorno' : 'primario'} larguraTotal>
            {c.atendido ? 'Voltar para pendentes' : 'Marcar como retornado'}
          </BotaoEnviar>
        </form>

        {!confirmando ? (
          <button type="button" onClick={() => setConfirmando(true)}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-danger/60 px-6 font-medium text-danger">
            Apagar
          </button>
        ) : (
          <form action={acaoApagar} className="flex flex-col gap-2 md:flex-row md:items-center">
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="confirmo" value="1" />
            <p className="text-sm text-texto">Apagar este contato? Não dá para desfazer.</p>
            <BotaoEnviar variante="perigo">Sim, apagar</BotaoEnviar>
            <button type="button" onClick={() => setConfirmando(false)}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-borda-campo px-6 font-medium text-texto">
              Manter
            </button>
          </form>
        )}
      </div>
      <Resultado estado={estadoAtendido} />
      <Resultado estado={estadoApagar} />
    </article>
  );
}
