'use client';

/**
 * Cabeçalho fixo com menu mobile acessível.
 *
 * Abaixo de 1024px vira menu em painel: no tablet retrato os quatro links +
 * o botão não cabem nos 680px do contêiner (docs/01-MOBILE-FIRST.md §3).
 *
 * Acessibilidade do painel:
 *   - aria-expanded/aria-controls no botão
 *   - foco vai para o 1º link ao abrir e volta ao botão ao fechar
 *   - Tab fica preso dentro do painel (WCAG 2.1.2 exige saída: Esc)
 *   - Esc fecha; rolagem do fundo travada enquanto aberto
 */
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { NAVEGACAO } from '@/lib/content/site';
import { PROFISSIONAL } from '@/lib/config';
import { Botao } from '@/components/ui/Botao';

export function Cabecalho() {
  const [aberto, setAberto] = useState(false);
  const idPainel = useId();
  const botaoRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  const fechar = useCallback((devolverFoco = true) => {
    setAberto(false);
    if (devolverFoco) botaoRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!aberto) return;

    const painel = painelRef.current;
    painel?.querySelector<HTMLElement>('a')?.focus();
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); fechar(); return; }
      if (e.key !== 'Tab' || !painel) return;

      const focaveis = [botaoRef.current, ...painel.querySelectorAll<HTMLElement>('a')]
        .filter((el): el is HTMLElement => el !== null);
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (!primeiro || !ultimo) return;

      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault(); ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault(); primeiro.focus();
      }
    }

    // Se a tela crescer para desktop com o menu aberto, fecha.
    const mq = window.matchMedia('(min-width: 1024px)');
    const aoMudar = () => { if (mq.matches) fechar(false); };

    document.addEventListener('keydown', aoTeclar);
    mq.addEventListener('change', aoMudar);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener('keydown', aoTeclar);
      mq.removeEventListener('change', aoMudar);
    };
  }, [aberto, fechar]);

  return (
    <>
    <header className="sticky top-0 z-50 bg-fundo/95 backdrop-blur-md border-b border-borda">
      <div className="wrap flex items-center justify-between h-16 lg:h-[4.75rem]">
        <Link
          href="/"
          className="flex flex-col justify-center leading-none"
          aria-label={`${PROFISSIONAL.nomeCurto} — página inicial`}
          onClick={() => aberto && fechar(false)}
        >
          <span className="font-display font-semibold text-[1.1875rem] lg:text-[1.3125rem] text-texto">
            {PROFISSIONAL.nomeCurto}
          </span>
          <span className="eyebrow mt-1.5">Médica</span>
        </Link>

        <nav aria-label="Principal" className="hidden lg:flex items-center gap-9">
          <ul className="flex items-center gap-8">
            {NAVEGACAO.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex items-center text-[0.9375rem] text-texto border-b border-transparent hover:border-gold-500 transition-colors"
                >
                  {item.rotulo}
                </Link>
              </li>
            ))}
          </ul>
          <Botao href="/agendar" variante="espresso">Agendar consulta</Botao>
        </nav>

        <button
          ref={botaoRef}
          type="button"
          className="lg:hidden -mr-2.5 inline-flex items-center justify-center size-11 rounded-full text-texto"
          aria-expanded={aberto}
          aria-controls={idPainel}
          aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
          onClick={() => (aberto ? fechar() : setAberto(true))}
        >
          {aberto ? <X aria-hidden size={24} strokeWidth={1.5} /> : <Menu aria-hidden size={24} strokeWidth={1.5} />}
        </button>
      </div>
    </header>

      {/* ⚠️ FORA do <header>: o backdrop-filter dele cria um bloco de contenção
          para `position: fixed`, e o painel ficava com altura ZERO — o menu
          "abria" invisível no celular. Logo depois do header no DOM, a ordem
          de Tab continua botão → links do painel. */}
      <div
        ref={painelRef}
        id={idPainel}
        hidden={!aberto}
        className="lg:hidden fixed inset-x-0 top-16 bottom-0 z-40 bg-fundo overflow-y-auto"
      >
        <nav aria-label="Principal (celular)" className="wrap flex flex-col min-h-full pt-6 pb-[calc(1.5rem+var(--safe-bottom))]">
          <ul className="flex flex-col">
            {NAVEGACAO.map((item) => (
              <li key={item.href} className="border-b border-borda">
                <Link
                  href={item.href}
                  onClick={() => fechar(false)}
                  className="flex items-center min-h-16 font-display text-h3 text-texto"
                >
                  {item.rotulo}
                </Link>
              </li>
            ))}
          </ul>
          {/* Ação primária na faixa inferior: alcance do polegar. */}
          <div className="mt-auto pt-8">
            <Botao href="/agendar" larguraTotalMobile onClick={() => fechar(false)}>
              Agendar consulta
            </Botao>
          </div>
        </nav>
      </div>
    </>
  );
}
