'use client';

/**
 * Holofote: um brilho suave que acompanha o ponteiro dentro dos cartões
 * marcados com `data-holofote` (estilo em app/globals.css, `.holofote`).
 *
 * Só com mouse/trackpad (`hover: hover` + `pointer: fine`) e sem pedido de
 * movimento reduzido. Um único listener passivo no documento; a posição é
 * gravada em --mx/--my no máximo uma vez por quadro.
 */
import { useEffect } from 'react';

export function Holofote() {
  useEffect(() => {
    const ponteiroFino = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const menosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!ponteiroFino || menosMovimento) return;

    let alvo: HTMLElement | null = null;
    let quadro = 0;
    let x = 0;
    let y = 0;

    const aplicar = () => {
      quadro = 0;
      if (!alvo) return;
      const r = alvo.getBoundingClientRect();
      alvo.style.setProperty('--mx', `${Math.round(x - r.left)}px`);
      alvo.style.setProperty('--my', `${Math.round(y - r.top)}px`);
    };

    const mover = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-holofote]') : null;
      alvo = el;
      x = e.clientX;
      y = e.clientY;
      if (alvo && !quadro) quadro = window.requestAnimationFrame(aplicar);
    };

    document.addEventListener('pointermove', mover, { passive: true });
    return () => {
      document.removeEventListener('pointermove', mover);
      if (quadro) window.cancelAnimationFrame(quadro);
    };
  }, []);

  return null;
}
