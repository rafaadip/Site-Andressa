import type { Metadata, Viewport } from 'next';
import { PROFISSIONAL } from '@/lib/config';
import { fonteDisplay, fonteSans, fonteCitacao } from '@/lib/fonts';
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
    images: [{ url: '/retratos/andressa-circular.png', width: 900, height: 900 }],
  },
  formatDetection: { telephone: false },   // o iOS não reformata o telefone por conta própria
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // viewport-fit=cover: necessário para env(safe-area-inset-*) no iPhone.
  viewportFit: 'cover',
  themeColor: '#FBF8F3',
  // NUNCA maximumScale/userScalable: bloquear zoom viola acessibilidade.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${fonteDisplay.variable} ${fonteSans.variable} ${fonteCitacao.variable}`}
    >
      <body>
        <a href="#conteudo" className="pular-para-conteudo">Pular para o conteúdo</a>
        {children}
      </body>
    </html>
  );
}
