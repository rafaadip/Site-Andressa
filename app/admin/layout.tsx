import type { Metadata } from 'next';

/** Todo o /admin: fora do índice e do sitemap (FASE-09 §5, FASE-11 §3). */
export const metadata: Metadata = {
  title: { default: 'Painel', template: '%s · Painel' },
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-fundo">{children}</div>;
}
