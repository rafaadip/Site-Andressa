/**
 * Layout de e-mail — FASE-08 §2.
 *
 * Um modelo de BLOCOS gera as duas versões (HTML e texto puro) a partir da
 * mesma fonte: a versão texto não pode ficar para trás (entregabilidade e
 * leitor de tela). Restrições que ditam o HTML:
 *   - tabela, não flex/grid (Outlook desktop);
 *   - CSS inline (vários clientes removem <style>);
 *   - largura máx. 600 px, 16 px de respiro lateral no celular;
 *   - fontes web não carregam: Georgia / system-ui;
 *   - nada essencial em imagem (imagem vem bloqueada);
 *   - botão com alvo ≥ 44 px, largura total no celular.
 */
import { MARCA as C } from '../marca';
import { identificacaoCfm, tituloPublico } from '../config';

export type Bloco =
  | { t: 'titulo'; texto: string }
  | { t: 'p'; texto: string }
  | { t: 'dados'; linhas: [rotulo: string, valor: string][] }
  | { t: 'botao'; href: string; rotulo: string; secundario?: boolean }
  | { t: 'nota'; texto: string };

export type Documento = {
  assunto: string;
  /** Linha de prévia mostrada pela caixa de entrada. */
  preheader: string;
  blocos: Bloco[];
};

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

export function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function blocoHtml(b: Bloco): string {
  switch (b.t) {
    case 'titulo':
      return `<h1 style="margin:0 0 16px;font-family:${SERIF};font-size:26px;line-height:1.25;font-weight:600;color:${C.ink};">${esc(b.texto)}</h1>`;
    case 'p':
      return `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink};">${esc(b.texto)}</p>`;
    case 'nota':
      return `<p style="margin:0 0 12px;font-family:${SANS};font-size:14px;line-height:1.6;color:${C['ink-muted']};">${esc(b.texto)}</p>`;
    case 'dados':
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border:1px solid ${C['sand-200']};border-radius:12px;background:${C['ivory-100']};">
${b.linhas.map(([r, v], i) => `<tr><td style="padding:${i === 0 ? '16px' : '4px'} 20px ${i === b.linhas.length - 1 ? '16px' : '4px'};font-family:${SANS};font-size:16px;line-height:1.5;color:${C.ink};">
<span style="display:block;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${C['gold-700']};">${esc(r)}</span>${esc(v)}</td></tr>`).join('\n')}
</table>`;
    case 'botao': {
      const fundo = b.secundario ? C['ivory-50'] : C['espresso-900'];
      const cor = b.secundario ? C.ink : C['ivory-50'];
      const borda = b.secundario ? C['sand-400'] : C['espresso-900'];
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;"><tr>
<td align="center" style="border-radius:999px;background:${fundo};border:1px solid ${borda};">
<a href="${esc(b.href)}" style="display:block;padding:14px 24px;font-family:${SANS};font-size:16px;font-weight:600;line-height:20px;color:${cor};text-decoration:none;border-radius:999px;">${esc(b.rotulo)}</a>
</td></tr></table>`;
    }
  }
}

function blocoTexto(b: Bloco): string {
  switch (b.t) {
    case 'titulo': return `${b.texto}\n${'='.repeat(Math.min(b.texto.length, 60))}`;
    case 'p': case 'nota': return b.texto;
    case 'dados': return b.linhas.map(([r, v]) => `${r}: ${v}`).join('\n');
    case 'botao': return `${b.rotulo}:\n${b.href}`;
  }
}

const URGENCIA = 'Este e-mail não atende urgências. Em emergência, procure o pronto-socorro ou ligue 192 (SAMU).';

export function renderizar(doc: Documento): { assunto: string; html: string; texto: string } {
  const rodapeHtml = `<p style="margin:0 0 6px;font-family:${SANS};font-size:13px;line-height:1.6;color:${C['ink-muted']};">${esc(identificacaoCfm())}<br>${esc(tituloPublico())}</p>
<p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C['ink-muted']};">${esc(URGENCIA)}</p>`;

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(doc.assunto)}</title></head>
<body style="margin:0;padding:0;background:${C['ivory-100']};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(doc.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C['ivory-100']};"><tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${C['ivory-50']};border-top:4px solid ${C['gold-500']};border-radius:12px;">
<tr><td style="padding:32px 24px 20px;">
${doc.blocos.map(blocoHtml).join('\n')}
</td></tr>
<tr><td style="padding:20px 24px 28px;border-top:1px solid ${C['sand-200']};">
${rodapeHtml}
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const texto = [
    ...doc.blocos.map(blocoTexto),
    '—',
    identificacaoCfm(),
    tituloPublico(),
    URGENCIA,
  ].join('\n\n');

  return { assunto: doc.assunto, html, texto };
}
