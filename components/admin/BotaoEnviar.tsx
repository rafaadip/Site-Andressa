'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

type Variante = 'primario' | 'contorno' | 'perigo';

const ESTILO: Record<Variante, string> = {
  primario: 'border-espresso-900 bg-espresso-900 text-ivory-100 hover:bg-espresso-700',
  contorno: 'border-borda-campo bg-transparent text-texto hover:border-ink',
  perigo: 'border-danger bg-danger text-ivory-50',
};

/** Botão de formulário com estado "enviando" (sem clique duplo). */
export function BotaoEnviar({ children, variante = 'primario', larguraTotal, name, value }: {
  children: ReactNode; variante?: Variante; larguraTotal?: boolean; name?: string; value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending || undefined}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-6 font-medium
                  transition-colors disabled:opacity-70 ${larguraTotal ? 'w-full md:w-auto' : ''} ${ESTILO[variante]}`}
    >
      {pending && <Loader2 aria-hidden size={18} className="animate-spin" />}
      {children}
    </button>
  );
}
