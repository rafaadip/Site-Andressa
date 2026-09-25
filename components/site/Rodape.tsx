import Link from 'next/link';
import { PROFISSIONAL, tituloPublico } from '@/lib/config';
import { URGENCIA } from '@/lib/content/site';

/** Nome + título + CRM em TODA página pública — exigência do CFM. */
export function Rodape() {
  const ano = new Date().getFullYear();
  return (
    // pb extra no celular: a barra fixa de agendamento não pode cobrir o texto.
    <footer className="superficie-escura pt-14 pb-[calc(6.5rem+var(--safe-bottom))] md:pb-[calc(3.5rem+var(--safe-bottom))]">
      <div className="wrap">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-display font-semibold text-[1.5rem] text-texto">{PROFISSIONAL.nome}</p>
            <p className="mt-1 text-texto-2">{tituloPublico()} · <span className="whitespace-nowrap">{PROFISSIONAL.crm}</span></p>
            <p className="mt-1 text-texto-2">{PROFISSIONAL.cidade} – {PROFISSIONAL.uf}</p>
          </div>
          <nav aria-label="Institucional">
            <ul className="flex flex-col gap-1 md:flex-row md:gap-8">
              <li><Link href="/politica-de-privacidade" className="inline-flex min-h-11 items-center text-sm text-texto-2 hover:text-texto">Política de privacidade</Link></li>
              <li><Link href="/termos-de-uso" className="inline-flex min-h-11 items-center text-sm text-texto-2 hover:text-texto">Termos de uso</Link></li>
            </ul>
          </nav>
        </div>
        <div className="mt-10 border-t border-borda pt-6 text-sm font-light text-texto-2 space-y-2">
          <p>
            As informações deste site têm caráter informativo e não substituem consulta médica.{' '}
            {URGENCIA.titulo} Em emergência, ligue <strong className="font-medium text-texto">{URGENCIA.telefone}</strong>.
          </p>
          <p>© {ano} {PROFISSIONAL.nome}.</p>
        </div>
      </div>
    </footer>
  );
}
