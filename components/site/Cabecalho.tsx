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
 *
 * Visual: no topo o cabeçalho se funde ao hero; depois de alguns pixels de
 * rolagem ganha vidro, fio e sombra (`data-rolou`, estilos em globals.css).
 */
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';
import { NAVEGACAO } from '@/lib/content/site';
import { PROFISSIONAL } from '@/lib/config';
import { Botao } from '@/components/ui/Botao';

export function Cabecalho() {
  const [aberto, setAberto] = useState(false);
  const [rolou, setRolou] = useState(false);
  const idPainel = useId();
  const botaoRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const progressoRef = useRef<HTMLSpanElement>(null);

  const fechar = useCallback((devolverFoco = true) => {
    setAberto(false);
    if (devolverFoco) botaoRef.current?.focus();
  }, []);

  // Estado "rolou" e progresso de leitura: um listener passivo, lido no
  // próximo frame. O progresso vai direto no estilo do fio (sem re-render).
  useEffect(() => {
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      const y = window.scrollY;
      setRolou(y > 8);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progressoRef.current?.style.setProperty('--progresso', String(max > 0 ? Math.min(1, y / max) : 0));
    };
    const aoRolar = () => { if (!quadro) quadro = window.requestAnimationFrame(medir); };
    aoRolar();   // página recarregada no meio: já nasce no estado certo
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => {
      window.removeEventListener('scroll', aoRolar);
      if (quadro) window.cancelAnimationFrame(quadro);
    };
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
    <header className="cabecalho sticky top-0 z-50" data-rolou={rolou && !aberto}>
      <div className="wrap flex h-[var(--altura-cabecalho)] items-center">
      <div className="cabecalho-barra flex h-[calc(var(--altura-cabecalho)-.75rem)] flex-1 items-center justify-between">
        <Link
          href="/"
          className="flex flex-col justify-center leading-none"
          aria-label={`${PROFISSIONAL.nomeCurto} — página inicial`}
          onClick={() => aberto && fechar(false)}
        >
          <span className="font-display font-[440] tracking-[-.015em] text-[1.25rem] lg:text-[1.375rem] text-texto">
            {PROFISSIONAL.nomeCurto}
          </span>
          <span className="eyebrow mt-1.5 text-[0.6875rem]">Médica</span>
        </Link>

        <nav aria-label="Principal" className="hidden lg:flex items-center gap-10">
          <ul className="flex items-center gap-8">
            {NAVEGACAO.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="link-nav inline-flex min-h-11 items-center text-[0.9375rem] text-texto-2 transition-colors duration-200 hover:text-texto"
                >
                  {item.rotulo}
                </Link>
              </li>
            ))}
          </ul>
          <Botao href="/agendar" variante="primario">Agendar consulta</Botao>
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
          <span aria-hidden className="icone-menu"><span /><span /></span>
        </button>
        <span ref={progressoRef} aria-hidden className="progresso-leitura" />
      </div>
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
        className="painel-menu lg:hidden fixed inset-x-0 top-[var(--altura-cabecalho)] bottom-0 z-40 border-t border-borda bg-fundo overflow-y-auto"
      >
        <nav aria-label="Principal (celular)" className="wrap flex flex-col min-h-full pt-4 pb-[calc(1.5rem+var(--safe-bottom))]">
          <ul className="flex flex-col">
            {NAVEGACAO.map((item, i) => (
              <li key={item.href} className="item-menu border-b border-borda" style={{ '--i': i } as CSSProperties}>
                <Link
                  href={item.href}
                  onClick={() => fechar(false)}
                  className="group flex items-center justify-between min-h-18 font-display text-[1.875rem] tracking-[-.01em] text-texto"
                >
                  {item.rotulo}
                  <ArrowRight aria-hidden size={22} strokeWidth={1.25} className="text-acento transition-transform duration-300 group-active:translate-x-1" />
                </Link>
              </li>
            ))}
          </ul>
          {/* Ação primária na faixa inferior: alcance do polegar. */}
          <div className="item-menu mt-auto pt-10" style={{ '--i': NAVEGACAO.length } as CSSProperties}>
            <Botao
              href="/agendar"
              variante="primario"
              larguraTotalMobile
              icone={<ArrowRight aria-hidden size={18} strokeWidth={1.75} />}
              onClick={() => fechar(false)}
            >
              Agendar consulta
            </Botao>
          </div>
        </nav>
      </div>
    </>
  );
}
