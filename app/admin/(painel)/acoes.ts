'use server';

/**
 * Server Actions do painel. Cada uma confere a sessão DE NOVO (o proxy é a
 * primeira porta; uma ação é um POST que pode chegar por fora da navegação)
 * e dispara Google + e-mail depois de responder, via `after()`.
 * O Next confere a Origem do POST (proteção CSRF) antes de executar.
 */
import { after } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { exigirAdminAcao, NaoAutorizadoError } from '@/lib/auth/admin';
import { nomeCookieSessao, opcoesCookie } from '@/lib/auth/sessao';
import {
  adicionarExtra, afetadosPor, anonimizarTitular, atualizarPoliticas, atualizarTipo, bloquear,
  cancelarPelaMedica, marcarFalta, OperacaoInvalidaError, periodoDoFormulario, remarcarPelaMedica,
  removerExcecao, restoDeHoje, salvarDia, type Decisao, type Faixa,
} from '@/lib/agendamento/admin';
import { practitionerId, SlotIndisponivelError } from '@/lib/agendamento/servico';
import { efeitosDe } from '@/lib/agendamento/efeitos';
import { removerConexao } from '@/lib/calendar/conexao';
import { receberDaAgenda } from '@/lib/calendar/receber';
import { reconciliar } from '@/lib/calendar/sincronizar';
import { processarFila } from '@/lib/notificacoes/fila';
import { DataInvalidaError } from '@/lib/datetime';
import { db, schema } from '@/lib/db';
import { log } from '@/lib/log';

export type Estado = { ok?: string; erro?: string } | null;

/** Erro de domínio vira mensagem na tela; o resto vai para o log. */
function mensagem(e: unknown): string {
  if (e instanceof OperacaoInvalidaError || e instanceof NaoAutorizadoError) return e.message;
  if (e instanceof SlotIndisponivelError) return 'Esse horário não está mais livre. Escolha outro.';
  if (e instanceof DataInvalidaError) return 'Data ou hora inválida.';
  log.excecao('admin.acao', e);
  return 'Não foi possível concluir. Tente de novo.';
}

const texto = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const inteiro = (fd: FormData, k: string) => Number.parseInt(texto(fd, k), 10);

function efeitos(ids: string[]) {
  if (ids.length) after(async () => { for (const id of ids) await efeitosDe(id); });
}

// ── Consulta ─────────────────────────────────────────────────────────────

export async function acaoCancelar(_: Estado, fd: FormData): Promise<Estado> {
  const id = texto(fd, 'id');
  try {
    await exigirAdminAcao();
    await cancelarPelaMedica(id, { motivo: texto(fd, 'recado') || null, avisar: fd.get('avisar') === 'on' });
    efeitos([id]);
  } catch (e) {
    return { erro: mensagem(e) };
  }
  revalidatePath('/admin');
  redirect('/admin?feito=cancelada');
}

export async function acaoFalta(_: Estado, fd: FormData): Promise<Estado> {
  const id = texto(fd, 'id');
  try {
    await exigirAdminAcao();
    await marcarFalta(id, fd.get('falta') === '1');
  } catch (e) {
    return { erro: mensagem(e) };
  }
  revalidatePath(`/admin/consulta/${id}`);
  revalidatePath('/admin');
  return { ok: fd.get('falta') === '1' ? 'Falta registrada.' : 'Falta desfeita.' };
}

export async function acaoRemarcar(_: Estado, fd: FormData): Promise<Estado> {
  const id = texto(fd, 'id');
  try {
    await exigirAdminAcao();
    const inicio = texto(fd, 'inicio');
    if (!inicio) return { erro: 'Escolha o novo horário.' };
    await remarcarPelaMedica(id, inicio);
    efeitos([id]);
  } catch (e) {
    return { erro: mensagem(e) };
  }
  revalidatePath('/admin');
  redirect(`/admin/consulta/${id}?feito=remarcada`);
}

// ── Disponibilidade ──────────────────────────────────────────────────────

/** Um toque a partir da agenda: sem ninguém afetado, bloqueia na hora. */
export async function acaoRestoDeHoje(): Promise<Estado> {
  let precisaDecidir = false;
  try {
    await exigirAdminAcao();
    const { inicio, fim } = restoDeHoje();
    if ((await afetadosPor(inicio, fim)).length > 0) precisaDecidir = true;
    else await bloquear({ inicio, fim, nota: 'Resto do dia' });
  } catch (e) {
    return { erro: mensagem(e) };
  }
  // Tem consulta no caminho: decisão explícita, uma a uma (FASE-09 §4).
  if (precisaDecidir) redirect('/admin/disponibilidade/bloquear?resto=1');
  revalidatePath('/admin');
  return { ok: 'Pronto: o resto de hoje está bloqueado.' };
}

export async function acaoBloquear(_: Estado, fd: FormData): Promise<Estado> {
  try {
    await exigirAdminAcao();
    const inicio = new Date(texto(fd, 'inicio'));
    const fim = new Date(texto(fd, 'fim'));
    const decisoes: Record<string, Decisao> = {};
    for (const [k, v] of fd.entries()) {
      if (k.startsWith('decisao:') && (v === 'cancelar' || v === 'manter')) decisoes[k.slice(8)] = v;
    }
    const { cancelados } = await bloquear({
      inicio, fim, nota: texto(fd, 'nota') || null, decisoes, motivoAoPaciente: texto(fd, 'recado') || null,
    });
    efeitos(cancelados);
  } catch (e) {
    return { erro: mensagem(e) };
  }
  revalidatePath('/admin');
  revalidatePath('/admin/disponibilidade');
  redirect('/admin/disponibilidade?feito=bloqueado');
}

export async function acaoExtra(_: Estado, fd: FormData): Promise<Estado> {
  try {
    await exigirAdminAcao();
    // O formulário manda UM dia com início e fim. Uma ação forjada com
    // meses de "extra" custava ~1 s de CPU em cada consulta pública de
    // horários, e "dia inteiro" ofertava 03:00 (SEC-20).
    const hi = texto(fd, 'hi');
    const hf = texto(fd, 'hf');
    if (!hi || !hf) throw new OperacaoInvalidaError('Informe o horário de início e de fim.');
    const { inicio, fim } = periodoDoFormulario({ de: texto(fd, 'de'), hi, hf });
    await adicionarExtra(inicio, fim, texto(fd, 'nota') || null);
  } catch (e) {
    return { erro: mensagem(e) };
  }
  revalidatePath('/admin/disponibilidade');
  return { ok: 'Horário extra adicionado.' };
}

export async function acaoRemoverExcecao(fd: FormData): Promise<void> {
  await exigirAdminAcao();
  await removerExcecao(texto(fd, 'id'));
  revalidatePath('/admin/disponibilidade');
}

/** O JSON vem do cliente: forma e modalidade conferidas antes do domínio. */
const FAIXAS = z.array(z.object({
  inicio: z.string().max(5),
  fim: z.string().max(5),
  modalidade: z.enum(['in_person', 'telehealth', 'ambas']),
})).max(12) satisfies z.ZodType<Faixa[]>;

export async function acaoSalvarDia(_: Estado, fd: FormData): Promise<Estado> {
  try {
    await exigirAdminAcao();
    const faixas = FAIXAS.safeParse(JSON.parse(texto(fd, 'faixas') || '[]'));
    if (!faixas.success) return { erro: 'Faixas inválidas.' };
    await salvarDia(inteiro(fd, 'dia'), faixas.data);
  } catch (e) {
    return { erro: e instanceof SyntaxError ? 'Faixas inválidas.' : mensagem(e) };
  }
  revalidatePath('/admin/disponibilidade');
  return { ok: 'Salvo.' };
}

// ── Configurações ────────────────────────────────────────────────────────

export async function acaoSalvarTipo(_: Estado, fd: FormData): Promise<Estado> {
  try {
    await exigirAdminAcao();
    await atualizarTipo(texto(fd, 'id'), {
      label: texto(fd, 'label'),
      durationMin: inteiro(fd, 'duracao'),
      bufferBeforeMin: inteiro(fd, 'antes'),
      bufferAfterMin: inteiro(fd, 'depois'),
      isActive: fd.get('ativo') === 'on',
    });
  } catch (e) {
    return { erro: mensagem(e) };
  }
  revalidatePath('/admin/configuracoes');
  return { ok: 'Modalidade salva.' };
}

export async function acaoSalvarPoliticas(_: Estado, fd: FormData): Promise<Estado> {
  try {
    await exigirAdminAcao();
    await atualizarPoliticas({
      leadTimeHours: inteiro(fd, 'antecedencia'),
      horizonDays: inteiro(fd, 'horizonte'),
      cancelDeadlineHours: inteiro(fd, 'prazo'),
      telehealthUrl: texto(fd, 'sala') || null,
      includeNoteInEvent: fd.get('motivoNoEvento') === 'on',
    });
  } catch (e) {
    return { erro: mensagem(e) };
  }
  revalidatePath('/admin/configuracoes');
  return { ok: 'Políticas salvas.' };
}

// ── Integrações ──────────────────────────────────────────────────────────

export async function acaoSincronizarAgora(): Promise<Estado> {
  try {
    await exigirAdminAcao();
    const pid = await practitionerId();
    const r = await receberDaAgenda(pid);
    const s = await reconciliar();
    await processarFila();
    revalidatePath('/admin', 'layout');
    return { ok: `Sincronizado. ${r ? `${r.eventos} mudança(s) lida(s)` : 'Agenda não conectada'} · ${s.synced} consulta(s) enviada(s).` };
  } catch (e) {
    return { erro: mensagem(e) };
  }
}

export async function acaoDesconectarGoogle(): Promise<Estado> {
  try {
    await exigirAdminAcao();
    await removerConexao(await practitionerId());
    await db().insert(schema.auditLog).values({ actor: 'practitioner', action: 'calendar.disconnected', meta: {} });
  } catch (e) {
    return { erro: mensagem(e) };
  }
  revalidatePath('/admin', 'layout');
  return { ok: 'Agenda desconectada. As consultas existentes continuam marcadas.' };
}

// ── LGPD ─────────────────────────────────────────────────────────────────

export async function acaoAnonimizar(_: Estado, fd: FormData): Promise<Estado> {
  try {
    await exigirAdminAcao();
    if (fd.get('confirmo') !== 'on') return { erro: 'Marque a confirmação para eliminar os dados.' };
    const r = await anonimizarTitular(texto(fd, 'email'));
    efeitos(r.canceladas);
    revalidatePath('/admin/privacidade');
    return { ok: `Dados eliminados de ${r.consultas} consulta(s).${r.canceladas.length ? ` ${r.canceladas.length} consulta(s) futura(s) cancelada(s).` : ''}` };
  } catch (e) {
    return { erro: mensagem(e) };
  }
}

// ── Sessão ───────────────────────────────────────────────────────────────

export async function acaoSair(): Promise<void> {
  (await cookies()).set(nomeCookieSessao(), '', opcoesCookie(0));
  redirect('/admin/entrar?saiu=1');
}
