'use client';

import { useActionState, useRef, useState } from 'react';
import { acaoCancelar, type Estado } from '@/app/admin/(painel)/acoes';
import { BotaoEnviar } from './BotaoEnviar';
import { Resultado } from './Resultado';

/**
 * Cancelar exige confirmação (FASE-09 §4) — no lugar, sem modal: o
 * formulário abre com o recado opcional e "Manter consulta" como saída.
 */
export function FormCancelar({ id, futura }: { id: string; futura: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao] = useActionState<Estado, FormData>(acaoCancelar, null);
  const recadoRef = useRef<HTMLTextAreaElement>(null);

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => { setAberto(true); requestAnimationFrame(() => recadoRef.current?.focus()); }}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-borda-campo px-6 font-medium text-texto hover:border-danger hover:text-danger md:w-auto"
      >
        Cancelar consulta…
      </button>
    );
  }

  return (
    <form action={acao} className="rounded-lg border border-danger/40 bg-elevado p-5">
      <input type="hidden" name="id" value={id} />
      <h3 className="font-medium text-texto">Cancelar esta consulta?</h3>
      <label htmlFor="recado" className="mt-4 mb-2 block text-sm font-medium text-texto">Recado ao paciente <span className="font-light text-texto-2">(opcional)</span></label>
      <textarea ref={recadoRef} id="recado" name="recado" rows={3} maxLength={300}
        placeholder="Ex.: surgiu um plantão. Peço desculpas — escolha outro horário pelo site."
        className="w-full rounded-md border border-borda-campo bg-elevado px-4 py-3 text-base text-texto" />
      {futura && (
        <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-texto">
          <input type="checkbox" name="avisar" defaultChecked className="size-6 accent-floresta-900" />
          Avisar o paciente por e-mail (com o cancelamento para o calendário dele)
        </label>
      )}
      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <BotaoEnviar variante="perigo" larguraTotal>Sim, cancelar</BotaoEnviar>
        <button type="button" onClick={() => setAberto(false)} className="inline-flex min-h-12 items-center justify-center rounded-full border border-borda-campo px-6 font-medium text-texto">
          Manter consulta
        </button>
      </div>
      <Resultado estado={estado} />
    </form>
  );
}
