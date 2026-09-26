/**
 * Prévia de link (WhatsApp, Instagram, Google) — FASE-11 §3.
 * 1200×630, gerada no build: retrato + nome + título + CRM, tudo de
 * lib/config.ts (o título muda sozinho quando houver RQE).
 *
 * Fontes da marca (OFL 1.1) em lib/og/fontes, em WOFF: o gerador (Satori)
 * lê TTF/OTF/WOFF, mas não woff2.
 */
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { PROFISSIONAL, tituloPublico } from '@/lib/config';
import { MARCA as C } from '@/lib/marca';

export const alt = `${PROFISSIONAL.nome} — ${tituloPublico()} · ${PROFISSIONAL.crm}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function ImagemOg() {
  const raiz = process.cwd();
  const [fraunces, dmSans, retrato] = await Promise.all([
    readFile(join(raiz, 'lib/og/fontes/Fraunces-Regular.woff')),
    readFile(join(raiz, 'lib/og/fontes/DMSans-Regular.woff')),
    // 900 px / 1 MB na origem → 420 px: a prévia do WhatsApp recusa imagem pesada.
    sharp(join(raiz, 'public/retratos/andressa-circular.png')).resize(420, 420).png({ compressionLevel: 9, palette: true }).toBuffer(),
  ]);

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: C['floresta-900'], padding: '64px 72px', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingRight: 48 }}>
          <div style={{ display: 'flex', fontFamily: 'DM Sans', fontSize: 22, letterSpacing: 5, color: C['oliva-200'], textTransform: 'uppercase' }}>
            {`${PROFISSIONAL.cidade} – ${PROFISSIONAL.uf}`}
          </div>
          <div style={{ display: 'flex', fontFamily: 'Fraunces', fontSize: 66, lineHeight: 1.08, letterSpacing: -1, color: C['ivory-100'], marginTop: 24 }}>
            {PROFISSIONAL.nome}
          </div>
          <div style={{ display: 'flex', width: 96, height: 3, background: C['oliva-500'], marginTop: 32 }} />
          <div style={{ display: 'flex', fontFamily: 'DM Sans', fontSize: 30, color: C['cream-muted'], marginTop: 28 }}>
            {tituloPublico()}
          </div>
          <div style={{ display: 'flex', fontFamily: 'DM Sans', fontSize: 26, color: C['cream-muted'], marginTop: 10 }}>
            {`${PROFISSIONAL.crm} · Agende online`}
          </div>
        </div>
        <div style={{ display: 'flex', position: 'relative', width: 420, height: 420 }}>
          <div style={{ position: 'absolute', left: 14, top: 14, width: 420, height: 420, borderRadius: 210, border: `2px solid ${C['oliva-500']}` }} />
          <img src={`data:image/png;base64,${retrato.toString('base64')}`} width={420} height={420} alt="" style={{ borderRadius: 210 }} />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Fraunces', data: fraunces, weight: 400, style: 'normal' },
        { name: 'DM Sans', data: dmSans, weight: 400, style: 'normal' },
      ],
    },
  );
}
