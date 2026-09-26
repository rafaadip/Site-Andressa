'use client';

import { useActionState } from 'react';
import { acaoRemarcar, type Estado } from '@/app/admin/(painel)/acoes';
import { BotaoEnviar } from './BotaoEnviar';
import { Resultado } from './Resultado';

export type DiaParaRemarcar = { data: string; titulo: string; slots: { inicio: string; rotulo: string }[] };

/**
 * Escolha do novo horário com rádios NATIVOS: teclado, leitor de tela e
 * validação de graça. Estilizados como botões de 44 px.
 */
export function FormRemarcar({ id, dias }: { id: string; dias: DiaParaRemarcar[] }) {
  const [estado, acao] = useActionState<Estado, FormData>(acaoRemarcar, null);
  const comVaga = dias.filter((d) => d.slots.length > 0);
  return (
    <form action={acao}>
      <input type="hidden" name="id" value={id} />
      {comVaga.length === 0 && <p className="rounded-lg border border-borda bg-superficie p-5 text-texto-2">Sem horários livres nestes dias.</p>}
      <div className="space-y-6">
        {comVaga.map((d) => (
          <fieldset key={d.data}>
            <legend className="mb-2 font-medium text-texto first-letter:uppercase">{d.titulo}</legend>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
              {d.slots.map((s) => (
                <label key={s.inicio} className="relative">
                  <input type="radio" name="inicio" value={s.inicio} required className="peer absolute inset-0 opacity-0" />
                  <span className="flex min-h-12 items-center justify-center rounded-md border border-borda-campo bg-elevado tabular text-texto
                                   peer-checked:border-espresso-900 peer-checked:bg-espresso-900 peer-checked:text-ivory-100
                                   peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus-ring)]">
                    {s.rotulo}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      {comVaga.length > 0 && (
        <div className="sticky bottom-[calc(4rem+var(--safe-bottom))] mt-6 border-t border-borda bg-fundo/95 py-3 backdrop-blur-md md:static md:border-0 md:bg-transparent">
          <BotaoEnviar larguraTotal>Remarcar e avisar o paciente</BotaoEnviar>
          <Resultado estado={estado} />
        </div>
      )}
    </form>
  );
}
