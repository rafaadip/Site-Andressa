'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { apagarMotivo } from './acoes';

/** Revogação do consentimento de saúde (LGPD Art. 8º §5º): apaga na hora. */
export function BotaoApagarMotivo({ token }: { token: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const router = useRouter();

  return (
    <div>
      <button
        type="button"
        disabled={pendente}
        aria-busy={pendente || undefined}
        onClick={() => iniciar(async () => {
          const r = await apagarMotivo(token);
          if (r.ok) router.refresh(); else setErro(r.mensagem);
        })}
        className="inline-flex min-h-12 items-center gap-2 rounded-full border border-borda-campo px-6 font-medium text-texto hover:border-ink"
      >
        {pendente && <Loader2 aria-hidden size={18} className="animate-spin" />}
        Apagar o motivo que escrevi
      </button>
      {erro && <p role="alert" className="mt-3 text-sm text-danger">{erro}</p>}
    </div>
  );
}
