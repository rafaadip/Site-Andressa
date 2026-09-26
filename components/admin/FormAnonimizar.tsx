'use client';

import { useActionState } from 'react';
import { acaoAnonimizar, type Estado } from '@/app/admin/(painel)/acoes';
import { BotaoEnviar } from './BotaoEnviar';
import { Resultado } from './Resultado';

/** Eliminação (LGPD Art. 18, VI) — irreversível, então confirmação explícita. */
export function FormAnonimizar({ email }: { email: string }) {
  const [estado, acao] = useActionState<Estado, FormData>(acaoAnonimizar, null);
  return (
    <form action={acao} className="rounded-lg border border-danger/40 bg-elevado p-4 md:p-5">
      <input type="hidden" name="email" value={email} />
      <h3 className="font-medium text-texto">Eliminar os dados deste titular</h3>
      <p className="mt-1 text-sm text-texto-2">
        Nome, contato e motivo são apagados de todas as consultas; o horário fica na agenda como
        “Titular removido”. Consultas futuras são canceladas sem aviso por e-mail e saem da sua agenda
        do Google. Não dá para desfazer.
      </p>
      <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 text-sm text-texto">
        <input type="checkbox" name="confirmo" className="mt-0.5 size-6 shrink-0 accent-floresta-900" />
        Confirmo que o titular pediu a eliminação dos dados.
      </label>
      <div className="mt-3"><BotaoEnviar variante="perigo" larguraTotal>Eliminar dados</BotaoEnviar></div>
      <Resultado estado={estado} />
    </form>
  );
}
