import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import Script from 'next/script';
import { PROFISSIONAL } from '@/lib/config';
import { MARCA } from '@/lib/marca';
import { fonteDisplay, fonteSans } from '@/lib/fonts';
import { urlSite } from '@/lib/seo';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(urlSite()),
  title: {
    default: `${PROFISSIONAL.nome} — Médica em ${PROFISSIONAL.cidade}, ${PROFISSIONAL.uf}`,
    template: `%s · ${PROFISSIONAL.nomeCurto}`,
  },
  description:
    `Consultas com atuação em Nutrologia, presenciais em ${PROFISSIONAL.cidade}–${PROFISSIONAL.uf}`
    + ' e por teleconsulta. Agende online e receba a confirmação no seu calendário.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: PROFISSIONAL.nomeCurto,
    // Imagem: app/opengraph-image.tsx (1200×630, leve para o WhatsApp).
  },
  formatDetection: { telephone: false },   // o iOS não reformata o telefone por conta própria
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // viewport-fit=cover: necessário para env(safe-area-inset-*) no iPhone.
  viewportFit: 'cover',
  themeColor: MARCA['ivory-50'],
  // NUNCA maximumScale/userScalable: bloquear zoom viola acessibilidade.
};

/**
 * Analytics sem cookie (ADR-005), opcional: só com NEXT_PUBLIC_PLAUSIBLE_DOMAIN.
 * Sem ele, nenhum script de terceiro é carregado.
 */
const PLAUSIBLE = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Ler o cabeçalho torna a renderização dinâmica — é o que permite a CSP
  // com nonce novo a cada requisição (proxy.ts). O Next aplica o nonce aos
  // próprios scripts sozinho; o daqui é para o script opcional de analytics.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html
      lang="pt-BR"
      className={`${fonteDisplay.variable} ${fonteSans.variable}`}
    >
      <body>
        <a href="#conteudo" className="pular-para-conteudo">Pular para o conteúdo</a>
        {children}
        {PLAUSIBLE && (
          <Script
            src="https://plausible.io/js/script.js"
            data-domain={PLAUSIBLE}
            strategy="afterInteractive"
            nonce={nonce}
          />
        )}
      </body>
    </html>
  );
}
