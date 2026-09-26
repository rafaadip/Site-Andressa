'use client';

import { useActionState } from 'react';
import { acaoSalvarPoliticas, type Estado } from '@/app/admin/(painel)/acoes';
import { BotaoEnviar } from './BotaoEnviar';
import { Resultado } from './Resultado';

const CAMPO = 'mt-1 block min-h-12 w-full rounded-md border border-borda-campo bg-elevado px-3 text-base text-texto';

export function FormPoliticas({ p }: { p: { lead: number; horizonte: number; prazo: number; sala: string; motivoNoEvento: boolean } }) {
  const [estado, acao] = useActionState<Estado, FormData>(acaoSalvarPoliticas, null);
  return (
    <form action={acao} className="space-y-4 rounded-lg border border-borda bg-elevado p-4 md:p-5">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm text-texto-2">Antecedência mínima (horas)<input type="number" name="antecedencia" min={0} max={168} defaultValue={p.lead} inputMode="numeric" required className={CAMPO} /></label>
        <label className="text-sm text-texto-2">Agenda aberta (dias à frente)<input type="number" name="horizonte" min={7} max={180} defaultValue={p.horizonte} inputMode="numeric" required className={CAMPO} /></label>
        <label className="text-sm text-texto-2">Cancelar pelo link até (horas antes)<input type="number" name="prazo" min={0} max={168} defaultValue={p.prazo} inputMode="numeric" required className={CAMPO} /></label>
      </div>
      <label className="block text-sm text-texto-2">Link fixo da sala de teleconsulta (opcional)
        <input type="url" name="sala" defaultValue={p.sala} placeholder="https://meet.google.com/…" className={CAMPO} />
        <span className="mt-1 block">Com ele, o paciente recebe o link na confirmação, nos lembretes e na página da consulta.</span>
      </label>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-texto">
        <input type="checkbox" name="motivoNoEvento" defaultChecked={p.motivoNoEvento} className="mt-0.5 size-6 shrink-0 accent-espresso-900" />
        <span>Incluir o motivo da consulta no evento da minha agenda do Google <span className="block text-texto-2">É dado de saúde: desmarcado, o evento traz só o link do painel.</span></span>
      </label>
      <BotaoEnviar larguraTotal>Salvar políticas</BotaoEnviar>
      <Resultado estado={estado} />
    </form>
  );
}
