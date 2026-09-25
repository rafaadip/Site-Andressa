/**
 * AES-256-GCM para segredos em repouso (refresh token do Google).
 *
 * Formato: base64( iv(12) | tag(16) | dados ). GCM autentica: um blob
 * adulterado — ou decifrado com a chave errada — LANÇA, em vez de virar
 * lixo silencioso que só estouraria na chamada ao Google.
 *
 * Ver docs/fases/FASE-05-google-calendar.md §2
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { envGoogle } from './env';

function chave(): Buffer {
  return Buffer.from(envGoogle().ENCRYPTION_KEY, 'base64');
}

export function cifrar(texto: string, k: Buffer = chave()): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k, iv);
  const dados = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), dados]).toString('base64');
}

export function decifrar(blob: string, k: Buffer = chave()): string {
  const b = Buffer.from(blob, 'base64');
  if (b.length < 29) throw new Error('Blob cifrado curto demais.');
  const d = createDecipheriv('aes-256-gcm', k, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return d.update(b.subarray(28)).toString('utf8') + d.final('utf8');
}
