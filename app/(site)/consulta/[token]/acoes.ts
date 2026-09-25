'use server';

import { revalidatePath } from 'next/cache';
import { cancelarPorToken, PrazoCancelamentoError } from '@/lib/agendamento/servico';

export type ResultadoCancelamento = { ok: true } | { ok: false; mensagem: string };

/** Server Action: o Next valida a Origem (proteção CSRF) antes de executar. */
export async function cancelarConsulta(token: string): Promise<ResultadoCancelamento> {
  try {
    await cancelarPorToken(token);
    revalidatePath(`/consulta/${token}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof PrazoCancelamentoError) return { ok: false, mensagem: e.message };
    console.error('[consulta] falha ao cancelar:', e instanceof Error ? e.name : typeof e);
    return { ok: false, mensagem: 'Não conseguimos cancelar agora. Tente de novo ou fale pelo WhatsApp.' };
  }
}
