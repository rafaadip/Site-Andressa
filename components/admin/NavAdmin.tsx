'use client';

import { useEffect, useState } from 'react';
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

/**
 * UX-02: numa tela cujo conteúdo termina perto da altura da barra fixa
 * (ex.: `/admin/consulta/[id]` com o alerta "Conecte sua agenda" no topo),
 * a tela "parece terminar" ali e some um botão de ação inteiro atrás dela,
 * sem nenhuma pista de que dá para rolar mais. Leve: só listeners passivos
 * de scroll/resize + um ResizeObserver no <body> (conteúdo que muda de
 * altura sem disparar resize da janela, como um formulário que expande).
 */
function useHaConteudoAbaixoDaBarra() {
  const [ha, setHa] = useState(false);

  useEffect(() => {
    function medir() {
      const restante = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      setHa(restante > 4);
    }
    medir();
    window.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    const obs = new ResizeObserver(medir);
    obs.observe(document.body);
    return () => {
      window.removeEventListener('scroll', medir);
      window.removeEventListener('resize', medir);
      obs.disconnect();
    };
  }, []);

  return ha;
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
  const haConteudoAbaixo = useHaConteudoAbaixoDaBarra();
  return (
      <nav aria-label="Painel (celular)" className="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-fundo/95 pb-[var(--safe-bottom)] backdrop-blur-md md:hidden">
        {/* Sombra "há mais abaixo": só um <span> absoluto (não fixed) dentro
            do <nav>, que já é o próprio bloco de contenção — nunca fixed
            dentro de elemento com backdrop-filter (regra nº 15). */}
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-fundo to-transparent transition-opacity duration-200 ${haConteudoAbaixo ? 'opacity-100' : 'opacity-0'}`}
        />
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
