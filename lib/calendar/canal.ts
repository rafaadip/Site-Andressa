/**
 * Canal push do Google (FASE-05 §5). Expira em ~30 dias: sem a renovação
 * diária, o webhook simplesmente para de chegar e ninguém percebe até o
 * primeiro horário ofertado em cima de um plantão.
 *
 * Só registra com URL pública HTTPS — o Google recusa localhost. Em
 * desenvolvimento, o cron de 15 min (`receberDaAgenda`) cobre o papel.
 */
import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { envGoogle } from '../env';
import { urlSite } from '../seo';
import { somarMinutos } from '../datetime';
import { log } from '../log';
import { clienteDa, conexaoAtiva, type Conexao } from './conexao';

const { calendarConnection } = schema;

const DURACAO_DIAS = 30;
/** Renova quando faltar menos que isto. */
const MARGEM_DIAS = 3;

export function webhookPossivel(): boolean {
  return urlSite().startsWith('https://');
}

export async function registrarCanal(conexao: Conexao, agora = new Date()): Promise<boolean> {
  if (!webhookPossivel()) return false;
  const cli = clienteDa(conexao);
  const expiraEm = somarMinutos(agora, DURACAO_DIAS * 24 * 60);
  const canal = await cli.observar({
    id: crypto.randomUUID(),
    endereco: `${urlSite()}/api/webhooks/google`,
    token: envGoogle().GOOGLE_WEBHOOK_TOKEN,
    expiraEm,
  });
  await db().update(calendarConnection).set({
    channelId: canal.id,
    channelResourceId: canal.resourceId,
    channelExpiresAt: canal.expiration ? new Date(Number(canal.expiration)) : expiraEm,
  }).where(eq(calendarConnection.id, conexao.id));

  // O canal antigo continuaria chegando até expirar: para.
  if (conexao.channelId && conexao.channelResourceId && conexao.channelId !== canal.id) {
    await cli.pararCanal(conexao.channelId, conexao.channelResourceId).catch(() => undefined);
  }
  return true;
}

/** Cron diário. */
export async function renovarCanalSePreciso(practitionerId: string, agora = new Date()) {
  const conexao = await conexaoAtiva(practitionerId);
  if (!conexao) return { renovado: false, motivo: 'sem-conexao' };
  const limite = somarMinutos(agora, MARGEM_DIAS * 24 * 60);
  if (conexao.channelExpiresAt && conexao.channelExpiresAt > limite) {
    return { renovado: false, motivo: 'em-dia' };
  }
  try {
    const ok = await registrarCanal(conexao, agora);
    return { renovado: ok, motivo: ok ? 'renovado' : 'sem-https' };
  } catch (e) {
    log.excecao('google.canal.falhou', e);
    return { renovado: false, motivo: 'erro' };
  }
}
