'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { CONFIRMAR_APAGAR_MOTIVO } from '@/lib/content/site';
import { apagarMotivo } from './acoes';

/**
 * Revogação do consentimento de saúde (LGPD Art. 8º §5º): apaga o motivo.
 *
 * Confirmação em DUAS etapas, sem modal (mesmo padrão de BotaoCancelar.tsx,
 * ui-ux-pro-max §8 `confirmation-dialogs`): apagar um dado de saúde é tão
 * irreversível quanto cancelar a consulta, e por isso merece a mesma
 * proteção contra toque acidental (achado UX-05).
 */
export function BotaoApagarMotivo({ token }: { token: string }) {
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
        className="inline-flex min-h-12 items-center rounded-full border border-borda-campo px-6 font-medium text-texto hover:border-ink"
      >
        {CONFIRMAR_APAGAR_MOTIVO.botaoInicial}
      </button>
    );
  }

  return (
    <div role="group" aria-labelledby="pergunta-apagar-motivo" className="rounded-lg border border-danger/40 bg-elevado p-5">
      <p id="pergunta-apagar-motivo" className="font-medium text-texto">{CONFIRMAR_APAGAR_MOTIVO.pergunta}</p>
      <p className="mt-1 text-sm text-texto-2">{CONFIRMAR_APAGAR_MOTIVO.aviso}</p>
      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <button
          ref={simRef}
          type="button"
          disabled={pendente}
          aria-busy={pendente || undefined}
          onClick={() => iniciar(async () => {
            const r = await apagarMotivo(token);
            if (r.ok) router.refresh(); else setErro(r.mensagem);
          })}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-danger px-6 font-medium text-ivory-50"
        >
          {pendente && <Loader2 aria-hidden size={18} className="animate-spin" />}
          {CONFIRMAR_APAGAR_MOTIVO.botaoConfirmar}
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => { setConfirmando(false); setErro(null); }}
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-borda-campo px-6 font-medium text-texto"
        >
          {CONFIRMAR_APAGAR_MOTIVO.botaoManter}
        </button>
      </div>
      {erro && <p role="alert" className="mt-3 text-sm text-danger">{erro}</p>}
    </div>
  );
}
