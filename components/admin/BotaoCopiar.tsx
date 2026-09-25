'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function BotaoCopiar({ texto, rotulo = 'Copiar dados' }: { texto: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 3000); } catch { /* sem permissão */ }
        }}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-borda-campo px-6 font-medium text-texto md:w-auto"
      >
        {copiado ? <Check aria-hidden size={18} /> : <Copy aria-hidden size={18} strokeWidth={1.75} />}
        {copiado ? 'Copiado' : rotulo}
      </button>
      <span role="status" className="sr-only">{copiado ? 'Dados copiados.' : ''}</span>
    </>
  );
}
