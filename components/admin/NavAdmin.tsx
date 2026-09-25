'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Clock, Plug, Settings, ShieldCheck } from 'lucide-react';

const ITENS = [
  { href: '/admin', rotulo: 'Agenda', Icone: CalendarDays },
  { href: '/admin/disponibilidade', rotulo: 'Horários', Icone: Clock },
  { href: '/admin/integracoes', rotulo: 'Integrações', Icone: Plug },
  { href: '/admin/configuracoes', rotulo: 'Ajustes', Icone: Settings },
  { href: '/admin/privacidade', rotulo: 'Privacidade', Icone: ShieldCheck },
] as const;

function ativo(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' || pathname.startsWith('/admin/consulta') : pathname.startsWith(href);
}

/** Desktop: navegação no cabeçalho. */
export function NavAdminTopo() {
  const pathname = usePathname();
  return (
      <nav aria-label="Painel" className="hidden md:block">
        <ul className="flex gap-1">
          {ITENS.map(({ href, rotulo }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={ativo(pathname, href) ? 'page' : undefined}
                className="inline-flex min-h-11 items-center rounded-full px-4 text-sm text-texto-2 hover:text-texto aria-[current=page]:bg-superficie aria-[current=page]:font-medium aria-[current=page]:text-texto"
              >
                {rotulo}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
  );
}

/**
 * Celular: barra fixa EMBAIXO — a médica usa com uma mão, entre um
 * atendimento e outro (FASE-09 §1).
 *
 * ⚠️ Fica FORA do <header>: o backdrop-filter dele cria um novo bloco de
 * contenção para `position: fixed`, e a barra "fixa embaixo" ia parar em
 * cima, cobrindo o cabeçalho.
 */
export function NavAdminRodape() {
  const pathname = usePathname();
  return (
      <nav aria-label="Painel (celular)" className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-fundo/95 pb-[var(--safe-bottom)] backdrop-blur-md md:hidden">
        <ul className="grid grid-cols-5">
          {ITENS.map(({ href, rotulo, Icone }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={ativo(pathname, href) ? 'page' : undefined}
                className="flex min-h-16 flex-col items-center justify-center gap-1 text-[.75rem] text-texto-2 aria-[current=page]:font-medium aria-[current=page]:text-texto"
              >
                <Icone aria-hidden size={22} strokeWidth={1.75} />
                {rotulo}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
  );
}
