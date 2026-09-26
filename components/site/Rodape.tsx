import Link from 'next/link';
import { PROFISSIONAL, tituloPublico } from '@/lib/config';
import { URGENCIA } from '@/lib/content/site';

/**
 * Nome + título + CRM em TODA página pública — exigência do CFM.
 * Visual: folha verde-floresta de cantos arredondados que sobe sobre a última
 * seção, com a assinatura gigante (só visual, fora da árvore de
 * acessibilidade) sangrando na base.
 */
export function Rodape() {
  const ano = new Date().getFullYear();
  const assinatura = PROFISSIONAL.nomeCurto.replace(/^Dra\.\s*/, '');
  return (
    // pb extra no celular: a barra fixa de agendamento não pode cobrir o texto.
    <footer
      className="superficie-escura secao-halo relative -mt-8 overflow-clip rounded-t-[1.75rem] pt-16
                 pb-[calc(6.5rem+var(--safe-bottom))] md:-mt-10 md:pt-20 md:pb-0 lg:rounded-t-[2.5rem]"
    >
      <div className="wrap">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="titulo-display text-[1.875rem] text-texto md:text-[2.375rem]">{PROFISSIONAL.nome}</p>
            <p className="mt-3 text-texto-2">{tituloPublico()} · <span className="whitespace-nowrap">{PROFISSIONAL.crm}</span></p>
            <p className="mt-1 text-texto-2">{PROFISSIONAL.cidade} – {PROFISSIONAL.uf}</p>
          </div>
          <nav aria-label="Institucional">
            <ul className="flex flex-col gap-1 md:flex-row md:gap-8">
              <li><Link href="/politica-de-privacidade" className="link-nav inline-flex min-h-11 items-center text-sm text-texto-2 transition-colors duration-200 hover:text-texto">Política de privacidade</Link></li>
              <li><Link href="/termos-de-uso" className="link-nav inline-flex min-h-11 items-center text-sm text-texto-2 transition-colors duration-200 hover:text-texto">Termos de uso</Link></li>
            </ul>
          </nav>
        </div>
        <div className="mt-12 border-t border-borda pt-7 text-sm text-texto-2 space-y-2">
          <p className="max-w-[80ch]">
            As informações deste site têm caráter informativo e não substituem consulta médica.{' '}
            {URGENCIA.titulo} Em emergência, ligue <strong className="font-medium text-texto">{URGENCIA.telefone}</strong>.
          </p>
          <p>© {ano} {PROFISSIONAL.nome}.</p>
        </div>
        <div aria-hidden className="rodape-marca mt-10 md:mt-16" data-marca={assinatura} />
      </div>
    </footer>
  );
}
