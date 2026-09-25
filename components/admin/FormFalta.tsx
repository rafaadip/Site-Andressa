'use client';

import { useActionState } from 'react';
import { acaoFalta, type Estado } from '@/app/admin/(painel)/acoes';
import { BotaoEnviar } from './BotaoEnviar';
import { Resultado } from './Resultado';

/** Falta é reversível: um toque para marcar, um para desfazer. */
export function FormFalta({ id, faltou }: { id: string; faltou: boolean }) {
  const [estado, acao] = useActionState<Estado, FormData>(acaoFalta, null);
  return (
    <form action={acao}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="falta" value={faltou ? '0' : '1'} />
      <BotaoEnviar variante="contorno" larguraTotal>{faltou ? 'Desfazer falta' : 'Marcar falta'}</BotaoEnviar>
      <Resultado estado={estado} />
    </form>
  );
}
