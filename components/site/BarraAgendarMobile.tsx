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
import { ArrowRight, MessageCircle } from 'lucide-react';
import { Botao } from '@/components/ui/Botao';
import { linkWhatsApp, MENSAGEM_AGENDAMENTO } from '@/lib/contato';

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
      className={`barra-agendar vidro md:hidden fixed inset-x-3 bottom-[calc(.75rem+var(--safe-bottom))] z-40
                  flex items-center gap-1.5 rounded-full p-1.5
                  ${visivel ? 'translate-y-0' : 'translate-y-[calc(100%+1.5rem+var(--safe-bottom))]'}`}
    >
      <Botao
        href="/agendar"
        variante="primario"
        larguraTotalMobile
        icone={<ArrowRight aria-hidden size={18} strokeWidth={1.75} />}
      >
        Agendar consulta
      </Botao>
      {/* Atalho para quem prefere conversar antes — o mesmo canal do "Fale pelo WhatsApp". */}
      <a
        href={linkWhatsApp(MENSAGEM_AGENDAMENTO)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp"
        className="grid size-12 shrink-0 place-items-center rounded-full border border-borda bg-elevado text-gold-700 transition-transform duration-150 active:scale-95"
      >
        <MessageCircle aria-hidden size={20} strokeWidth={1.6} />
      </a>
    </div>
  );
}
