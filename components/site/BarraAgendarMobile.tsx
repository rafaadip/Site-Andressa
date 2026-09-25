'use client';

/**
 * Barra fixa "Agendar consulta" no rodapé da tela — só no celular.
 *
 * O CTA do cabeçalho fica no topo, fora do alcance do polegar em telas
 * grandes (docs/01-MOBILE-FIRST.md §5). Esta barra põe a ação primária na
 * faixa inferior, mas:
 *   - só aparece depois que o hero sai da tela (o hero já tem o CTA);
 *   - some quando a seção de agendamento está visível (evita CTA duplicado);
 *   - respeita safe-area-inset-bottom (barra de gestos do iPhone);
 *   - quando escondida fica `inert`, fora da ordem de Tab e do leitor de tela.
 */
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Botao } from '@/components/ui/Botao';

export function BarraAgendarMobile() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const hero = document.getElementById('inicio');
    const agendar = document.getElementById('agendar');
    if (!hero) return;

    const estado = { heroVisivel: true, agendarVisivel: false };
    const atualizar = () => setVisivel(!estado.heroVisivel && !estado.agendarVisivel);

    const obs = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (e.target === hero) estado.heroVisivel = e.isIntersecting;
        if (e.target === agendar) estado.agendarVisivel = e.isIntersecting;
      }
      atualizar();
    }, { threshold: 0 });

    obs.observe(hero);
    if (agendar) obs.observe(agendar);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      data-testid="barra-agendar"
      inert={!visivel}
      aria-hidden={!visivel}
      className={`md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-fundo/95 backdrop-blur-md
                  px-[var(--gutter)] pt-3 pb-[calc(.75rem+var(--safe-bottom))]
                  transition-transform duration-300 ease-out
                  ${visivel ? 'translate-y-0' : 'translate-y-full'}`}
    >
      <Botao
        href="/agendar"
        larguraTotalMobile
        icone={<ArrowRight aria-hidden size={18} strokeWidth={1.75} />}
      >
        Agendar consulta
      </Botao>
    </div>
  );
}
