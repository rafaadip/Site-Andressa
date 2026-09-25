'use client';

import { useActionState } from 'react';
import { acaoExtra, type Estado } from '@/app/admin/(painel)/acoes';
import { BotaoEnviar } from './BotaoEnviar';
import { Resultado } from './Resultado';

const CAMPO = 'mt-1 block min-h-12 w-full rounded-md border border-borda-campo bg-elevado px-3 text-base text-texto';

/** Horário extra: um encaixe fora da semana padrão (ex.: sábado de mutirão). */
export function FormExtra({ hoje }: { hoje: string }) {
  const [estado, acao] = useActionState<Estado, FormData>(acaoExtra, null);
  return (
    <form action={acao} className="rounded-lg border border-borda bg-elevado p-4 md:p-5">
      <h3 className="font-medium text-texto">Abrir horário extra</h3>
      <p className="mt-1 text-sm text-texto-2">Vale para as duas modalidades.</p>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="col-span-2 text-sm text-texto-2 md:col-span-1">Dia<input type="date" name="de" min={hoje} required className={CAMPO} /></label>
        <label className="text-sm text-texto-2">Das<input type="time" name="hi" step={300} required className={`${CAMPO} tabular`} /></label>
        <label className="text-sm text-texto-2">às<input type="time" name="hf" step={300} required className={`${CAMPO} tabular`} /></label>
        <label className="col-span-2 text-sm text-texto-2 md:col-span-1">Nota<input type="text" name="nota" maxLength={120} placeholder="Opcional" className={CAMPO} /></label>
      </div>
      <div className="mt-4"><BotaoEnviar variante="contorno" larguraTotal>Adicionar</BotaoEnviar></div>
      <Resultado estado={estado} />
    </form>
  );
}
