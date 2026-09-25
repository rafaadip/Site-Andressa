'use client';

import { useActionState, useState } from 'react';
import { acaoDesconectarGoogle, acaoSincronizarAgora, type Estado } from '@/app/admin/(painel)/acoes';
import { BotaoEnviar } from './BotaoEnviar';
import { Resultado } from './Resultado';

export function SincronizarAgora() {
  const [estado, acao] = useActionState<Estado>(acaoSincronizarAgora, null);
  return (
    <form action={acao}>
      <BotaoEnviar variante="contorno" larguraTotal>Sincronizar agora</BotaoEnviar>
      <Resultado estado={estado} />
    </form>
  );
}

/** Desconectar pede confirmação (FASE-09 §4): sem a agenda, o site fica cego. */
export function DesconectarGoogle() {
  const [confirmando, setConfirmando] = useState(false);
  const [estado, acao] = useActionState<Estado>(acaoDesconectarGoogle, null);
  if (!confirmando) {
    return (
      <button type="button" onClick={() => setConfirmando(true)}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-borda-campo px-6 font-medium text-texto hover:border-danger hover:text-danger md:w-auto">
        Desconectar…
      </button>
    );
  }
  return (
    <form action={acao} className="rounded-lg border border-danger/40 p-4">
      <p className="text-sm text-texto">Sem a agenda, o site não enxerga seus plantões e só oferece horários a partir de depois de amanhã. As consultas já marcadas continuam.</p>
      <div className="mt-3 flex flex-col gap-2 md:flex-row">
        <BotaoEnviar variante="perigo" larguraTotal>Sim, desconectar</BotaoEnviar>
        <button type="button" onClick={() => setConfirmando(false)} className="inline-flex min-h-12 items-center justify-center rounded-full border border-borda-campo px-6 font-medium text-texto">Manter conectada</button>
      </div>
      <Resultado estado={estado} />
    </form>
  );
}
