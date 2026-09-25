'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  cancelarPorToken, revogarMotivoPorToken, PrazoCancelamentoError,
} from '@/lib/agendamento/servico';
import { efeitosDe } from '@/lib/agendamento/efeitos';
import { log } from '@/lib/log';

export type ResultadoAcao = { ok: true } | { ok: false; mensagem: string };

/** Server Action: o Next valida a Origem (proteção CSRF) antes de executar. */
export async function cancelarConsulta(token: string): Promise<ResultadoAcao> {
  try {
    const g = await cancelarPorToken(token);
    after(() => efeitosDe(g.linha.id));
    revalidatePath(`/consulta/${token}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof PrazoCancelamentoError) return { ok: false, mensagem: e.message };
    log.excecao('consulta.cancelar', e);
    return { ok: false, mensagem: 'Não conseguimos cancelar agora. Tente de novo ou fale pelo WhatsApp.' };
  }
}

/** LGPD: revogar o consentimento de saúde apaga o motivo na hora. */
export async function apagarMotivo(token: string): Promise<ResultadoAcao> {
  try {
    const g = await revogarMotivoPorToken(token);
    after(() => efeitosDe(g.linha.id));
    revalidatePath(`/consulta/${token}`);
    return { ok: true };
  } catch (e) {
    log.excecao('consulta.apagar-motivo', e);
    return { ok: false, mensagem: 'Não conseguimos apagar agora. Tente de novo ou escreva para o e-mail da política de privacidade.' };
  }
}
