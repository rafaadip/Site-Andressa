'use client';

/**
 * Revelação suave das seções ao rolar (fade + subida curta).
 *
 * Aprimoramento progressivo, por construção:
 *   - sem JS, ou antes da hidratação, TUDO está visível — nada nasce oculto
 *     no HTML;
 *   - só é escondido o que ainda está ABAIXO da dobra quando o JS roda:
 *     o que a pessoa já vê nunca pisca;
 *   - `prefers-reduced-motion: reduce` desliga tudo;
 *   - itens que entram juntos ganham um atraso em cascata (70 ms, teto de
 *     7 itens), na ordem do documento.
 *
 * Marcação: `data-revelar` no elemento (`data-revelar="titulo"` nos
 * cabeçalhos de seção, que animam as partes em vez do bloco). O estado vai
 * em `data-revelado` ("nao" → "sim"), atributo que o React não controla —
 * nenhum re-render o desfaz. Esconder é instantâneo; só a entrada anima
 * (app/globals.css, só transform/opacity/clip-path).
 */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const PASSO_MS = 70;
const TETO_CASCATA = 7;
/** Maior transição da entrada (globals.css) com folga. */
const DURACAO_MS = 1900;

export function Revelar() {
  const caminho = usePathname();

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const dobra = window.innerHeight;
    const alvos = [...document.querySelectorAll<HTMLElement>('[data-revelar]:not([data-revelado])')]
      .filter((el) => el.getBoundingClientRect().top >= dobra);
    if (alvos.length === 0) return;

    for (const el of alvos) el.dataset.revelado = 'nao';

    const limpezas: number[] = [];
    const obs = new IntersectionObserver((entradas) => {
      const chegando = entradas
        .filter((e) => e.isIntersecting)
        .map((e) => e.target as HTMLElement)
        .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

      chegando.forEach((el, i) => {
        const atraso = Math.min(i, TETO_CASCATA) * PASSO_MS;
        el.style.setProperty('--atraso', `${atraso}ms`);
        el.dataset.revelado = 'sim';
        obs.unobserve(el);
        // Terminada a entrada, limpa o estado: as transições próprias do
        // elemento (hover de cartão, por exemplo) voltam a valer sem atraso.
        limpezas.push(window.setTimeout(() => {
          el.removeAttribute('data-revelado');
          el.style.removeProperty('--atraso');
        }, DURACAO_MS + atraso));
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });

    for (const el of alvos) obs.observe(el);
    return () => {
      obs.disconnect();
      limpezas.forEach((t) => window.clearTimeout(t));
      // Nada fica escondido para trás (ex.: DOM reaproveitado na volta).
      for (const el of alvos) {
        el.removeAttribute('data-revelado');
        el.style.removeProperty('--atraso');
      }
    };
  }, [caminho]);

  return null;
}
