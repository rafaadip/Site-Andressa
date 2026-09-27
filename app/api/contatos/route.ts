import { schemaCriarContato } from '@/lib/validation/contato';
import { errosPorCampo } from '@/lib/validation/agendamento';
import { registrarContato } from '@/lib/contatos/servico';
import { ipDaRequisicao } from '@/lib/seguranca';
import { erro, SEM_CACHE, traduzirErro } from '@/lib/api/respostas';

export const dynamic = 'force-dynamic';

const TAMANHO_MAXIMO = 4 * 1024;

/**
 * POST /api/contatos — pedido de contato do formulário da home.
 * Valida de novo com o MESMO schema do navegador (nunca confia no cliente),
 * grava e responde só `{ ok: true }`: nenhum dado do paciente volta.
 * Mesma origem: o navegador não envia este POST de outro site com JSON sem
 * preflight, e o Content-Type é conferido.
 */
export async function POST(req: Request) {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return erro(415, { erro: 'VALIDACAO', mensagem: 'Formato não suportado.' });
  }

  const texto = await req.text();
  if (texto.length > TAMANHO_MAXIMO) {
    return erro(413, { erro: 'VALIDACAO', mensagem: 'Requisição grande demais.' });
  }

  let corpo: unknown;
  try { corpo = JSON.parse(texto); } catch {
    return erro(400, { erro: 'VALIDACAO', mensagem: 'JSON inválido.' });
  }

  const p = schemaCriarContato.safeParse(corpo);
  if (!p.success) {
    return erro(422, { erro: 'VALIDACAO', mensagem: 'Revise os campos destacados.', campos: errosPorCampo(p.error) });
  }
  // Honeypot preenchido: robô. Resposta de sucesso, sem gravar — não ensina
  // ao robô que foi detectado.
  if (p.data.site) return Response.json({ ok: true }, { status: 201, headers: SEM_CACHE });

  try {
    await registrarContato(p.data, { ip: ipDaRequisicao(req.headers) });
    return Response.json({ ok: true }, { status: 201, headers: SEM_CACHE });
  } catch (e) {
    return traduzirErro(e);
  }
}
