'use client';

import { useActionState } from 'react';
import { Ban } from 'lucide-react';
import { acaoRestoDeHoje, type Estado } from '@/app/admin/(painel)/acoes';
import { BotaoEnviar } from './BotaoEnviar';
import { Resultado } from './Resultado';

/**
 * "Bloquear o resto de hoje" — para quando o plantão estende. UM toque se
 * não houver consulta no caminho; senão, abre a decisão por consulta.
 * Sem confirmação extra: é reversível (remove-se o bloqueio).
 */
export function BloquearRestoDeHoje() {
  const [estado, acao] = useActionState<Estado>(acaoRestoDeHoje, null);
  return (
    <form action={acao}>
      <BotaoEnviar variante="contorno" larguraTotal><Ban aria-hidden size={18} strokeWidth={1.75} />Bloquear o resto de hoje</BotaoEnviar>
      <Resultado estado={estado} />
    </form>
  );
}
