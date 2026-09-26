'use client';

import { useActionState } from 'react';
import { acaoSalvarTipo, type Estado } from '@/app/admin/(painel)/acoes';
import { BotaoEnviar } from './BotaoEnviar';
import { Resultado } from './Resultado';

const CAMPO = 'mt-1 block min-h-12 w-full rounded-md border border-borda-campo bg-elevado px-3 text-base text-texto';

export function FormTipo({ t }: { t: { id: string; label: string; duracao: number; antes: number; depois: number; ativo: boolean; modalidade: string } }) {
  const [estado, acao] = useActionState<Estado, FormData>(acaoSalvarTipo, null);
  return (
    <form action={acao} className="space-y-3 rounded-lg border border-borda bg-elevado p-4 md:p-5">
      <input type="hidden" name="id" value={t.id} />
      <p className="eyebrow">{t.modalidade === 'telehealth' ? 'Teleconsulta' : 'Presencial'}</p>
      <label className="block text-sm text-texto-2">Nome no site<input type="text" name="label" defaultValue={t.label} minLength={3} maxLength={60} required className={CAMPO} /></label>
      <div className="grid grid-cols-3 gap-3">
        <label className="text-sm text-texto-2">Duração (min)<input type="number" name="duracao" min={10} max={240} defaultValue={t.duracao} inputMode="numeric" required className={CAMPO} /></label>
        <label className="text-sm text-texto-2">Intervalo antes<input type="number" name="antes" min={0} max={120} defaultValue={t.antes} inputMode="numeric" required className={CAMPO} /></label>
        <label className="text-sm text-texto-2">Intervalo depois<input type="number" name="depois" min={0} max={120} defaultValue={t.depois} inputMode="numeric" required className={CAMPO} /></label>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-texto">
        <input type="checkbox" name="ativo" defaultChecked={t.ativo} className="size-6 accent-floresta-900" />Oferecer no site
      </label>
      <BotaoEnviar variante="contorno" larguraTotal>Salvar</BotaoEnviar>
      <Resultado estado={estado} />
    </form>
  );
}
