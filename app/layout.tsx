import type { Metadata, Viewport } from 'next';
import { PROFISSIONAL, tituloPublico } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: `${PROFISSIONAL.nome} — ${PROFISSIONAL.cidade}, ${PROFISSIONAL.uf}`,
    template: `%s · ${PROFISSIONAL.nomeCurto}`,
  },
  description:
    `Consultas em Nutrologia, presenciais em ${PROFISSIONAL.cidade}–${PROFISSIONAL.uf}`
    + ' e por teleconsulta. Agende online e receba a confirmação no seu calendário.',
  alternates: { canonical: '/' },
  openGraph: { type: 'website', locale: 'pt_BR', siteName: PROFISSIONAL.nomeCurto },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // viewport-fit=cover: necessário para env(safe-area-inset-*) no iPhone.
  viewportFit: 'cover',
  themeColor: '#FBF8F3',
  // NUNCA maximumScale/userScalable: bloquear zoom é violação de acessibilidade.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a href="#conteudo" className="pular-para-conteudo">Pular para o conteúdo</a>
        {children}
        <footer className="rodape-legal">
          <div className="wrap">
            <p>
              <strong>{PROFISSIONAL.nome}</strong> · {tituloPublico()} · {PROFISSIONAL.crm}
            </p>
            <p>
              As informações deste site têm caráter informativo e não substituem
              consulta médica. Em emergência, procure o pronto-socorro mais próximo
              ou ligue <strong>192 (SAMU)</strong>.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
