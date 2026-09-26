'use client';

import { useActionState } from 'react';
import { acaoBloquear, type Estado } from '@/app/admin/(painel)/acoes';
import { BotaoEnviar } from './BotaoEnviar';
import { Resultado } from './Resultado';

export type Afetado = { id: string; hora: string; nome: string; tipo: string };

/**
 * Confirmação do bloqueio. Com consulta no período, cada uma exige uma
 * escolha — sem valor padrão: bloquear nunca cancela em silêncio.
 */
export function FormBloquear({ inicio, fim, nota, afetados }: { inicio: string; fim: string; nota: string; afetados: Afetado[] }) {
  const [estado, acao] = useActionState<Estado, FormData>(acaoBloquear, null);
  return (
    <form action={acao} className="mt-6">
      <input type="hidden" name="inicio" value={inicio} />
      <input type="hidden" name="fim" value={fim} />
      <input type="hidden" name="nota" value={nota} />

      {afetados.length > 0 && (
        <>
          <p className="rounded-md border border-danger/40 bg-superficie p-4 text-sm text-texto">
            {afetados.length === 1 ? 'Há 1 consulta' : `Há ${afetados.length} consultas`} neste período. Decida o que fazer com cada uma.
          </p>
          <ul className="mt-4 space-y-3">
            {afetados.map((a) => (
              <li key={a.id}>
                <fieldset className="rounded-lg border border-borda bg-elevado p-4">
                  <legend className="px-1 font-medium text-texto"><span className="tabular">{a.hora}</span> · {a.nome}</legend>
                  <p className="text-sm text-texto-2">{a.tipo}</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-borda-campo px-3 text-sm text-texto has-[:checked]:border-danger">
                      <input type="radio" name={`decisao:${a.id}`} value="cancelar" required className="size-5 accent-floresta-900" />
                      Cancelar e avisar o paciente
                    </label>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-borda-campo px-3 text-sm text-texto has-[:checked]:border-floresta-900">
                      <input type="radio" name={`decisao:${a.id}`} value="manter" required className="size-5 accent-floresta-900" />
                      Manter (vou atender)
                    </label>
                  </div>
                </fieldset>
              </li>
            ))}
          </ul>
          <label htmlFor="recado" className="mt-5 mb-2 block text-sm font-medium text-texto">Recado aos pacientes cancelados <span className="font-light text-texto-2">(opcional)</span></label>
          <textarea id="recado" name="recado" rows={2} maxLength={300}
            className="w-full rounded-md border border-borda-campo bg-elevado px-4 py-3 text-base text-texto" />
        </>
      )}

      <div className="mt-6"><BotaoEnviar larguraTotal>Confirmar bloqueio</BotaoEnviar></div>
      <Resultado estado={estado} />
    </form>
  );
}
