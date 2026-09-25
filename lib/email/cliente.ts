/**
 * Envio de e-mail pela Resend (API REST, sem SDK) — FASE-08.
 *
 * `Idempotency-Key` = chave de deduplicação da fila: se o processo morrer
 * depois de enviar e antes de marcar como enviado, a nova tentativa NÃO
 * vira um segundo e-mail (a Resend guarda a chave por 24 h).
 */
import { envEmail } from '../env';

export type Anexo = { nome: string; conteudo: string; tipo: string };

export type Mensagem = {
  para: string;
  assunto: string;
  html: string;
  texto: string;
  anexos?: Anexo[];
  cabecalhos?: Record<string, string>;
  idempotencia: string;
};

export class EmailError extends Error {
  constructor(readonly status: number, readonly codigo: string) {
    super(`Resend ${status} (${codigo})`);
    this.name = 'EmailError';
  }
  /** 429 e 5xx passam; 4xx de validação não vão passar tentando de novo. */
  get transitorio(): boolean { return this.status === 0 || this.status === 429 || this.status >= 500; }
}

export async function enviarEmail(m: Mensagem): Promise<{ id: string }> {
  const env = envEmail();
  let r: Response;
  try {
    r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': m.idempotencia.slice(0, 256),
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [m.para],
        subject: m.assunto,
        html: m.html,
        text: m.texto,
        ...(env.EMAIL_REPLY_TO ? { reply_to: env.EMAIL_REPLY_TO } : {}),
        ...(m.cabecalhos ? { headers: m.cabecalhos } : {}),
        ...(m.anexos?.length ? {
          attachments: m.anexos.map((a) => ({
            filename: a.nome,
            content: Buffer.from(a.conteudo, 'utf8').toString('base64'),
            content_type: a.tipo,
          })),
        } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
  } catch {
    throw new EmailError(0, 'rede');
  }
  if (!r.ok) {
    const corpo = await r.json().catch(() => null) as { name?: string } | null;
    throw new EmailError(r.status, corpo?.name ?? 'desconhecido');
  }
  const corpo = await r.json() as { id: string };
  return { id: corpo.id };
}
