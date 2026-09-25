import { Cabecalho } from '@/components/site/Cabecalho';
import { Rodape } from '@/components/site/Rodape';

export default function LayoutSite({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Cabecalho />
      <main id="conteudo" tabIndex={-1} className="outline-none">{children}</main>
      <Rodape />
    </>
  );
}
