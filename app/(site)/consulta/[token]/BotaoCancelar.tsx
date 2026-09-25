'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { cancelarConsulta } from './acoes';

/**
 * Cancelamento em DUAS etapas (ação destrutiva, ui-ux-pro-max §8
 * `confirmation-dialogs`), sem modal: a confirmação aparece no lugar,
 * com "Manter consulta" como saída óbvia.
 */
export function BotaoCancelar({ token, quando }: { token: string; quando: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();
  const simRef = useRef<HTMLButtonElement>(null);

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => { setConfirmando(true); requestAnimationFrame(() => simRef.current?.focus()); }}
        className="inline-flex min-h-12 items-center rounded-full border border-borda-campo px-6 font-medium text-texto hover:border-danger hover:text-danger"
      >
        Cancelar consulta
      </button>
    );
  }

  return (
    <div role="group" aria-labelledby="pergunta-cancelar" className="rounded-lg border border-danger/40 bg-elevado p-5">
      <p id="pergunta-cancelar" className="font-medium text-texto">Cancelar a consulta de {quando}?</p>
      <p className="mt-1 text-sm text-texto-2">O horário será liberado para outra pessoa.</p>
      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <button
          ref={simRef}
          type="button"
          disabled={pendente}
          aria-busy={pendente || undefined}
          onClick={() => iniciar(async () => {
            const r = await cancelarConsulta(token);
            if (r.ok) router.refresh(); else setErro(r.mensagem);
          })}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-danger px-6 font-medium text-ivory-50"
        >
          {pendente && <Loader2 aria-hidden size={18} className="animate-spin" />}
          Sim, cancelar
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => { setConfirmando(false); setErro(null); }}
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-borda-campo px-6 font-medium text-texto"
        >
          Manter consulta
        </button>
      </div>
      {erro && <p role="alert" className="mt-3 text-sm text-danger">{erro}</p>}
    </div>
  );
}
