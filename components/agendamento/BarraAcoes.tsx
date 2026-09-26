import type { ReactNode } from 'react';

/**
 * Ações da etapa. No CELULAR fica presa ao rodapé da tela: a ação primária
 * na faixa do polegar e visível enquanto a grade de horários rola
 * (docs/01-MOBILE-FIRST.md §5). safe-area-inset-bottom: sem ele, o botão
 * fica sob a barra de gestos do iPhone. No tablet/desktop volta ao fluxo.
 */
export function BarraAcoes({ children }: { children: ReactNode }) {
  return (
    <div
      className="sticky bottom-0 z-10 -mx-[var(--gutter)] mt-8 flex gap-3 border-t border-borda
                 bg-fundo/95 px-[var(--gutter)] pt-3 pb-[calc(.75rem+var(--safe-bottom))] backdrop-blur-md
                 md:static md:mx-0 md:mt-10 md:border-0 md:bg-transparent md:px-0 md:pb-0 md:pt-0 md:backdrop-blur-none"
    >
      {children}
    </div>
  );
}

type BotaoAcao = {
  onClick?: () => void;
  children: ReactNode;
  tipo?: 'button' | 'submit';
  ocupado?: boolean;
  secundario?: boolean;
  /** Visualmente "desativado", mas focável e clicável: o clique explica o que falta. */
  pendente?: boolean;
};

export function BotaoAcao({ onClick, children, tipo = 'button', ocupado, secundario, pendente }: BotaoAcao) {
  const base = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-6 font-medium tracking-[.03em] transition-[background-color,border-color,opacity,transform] duration-200 active:scale-[.98]';
  const estilo = secundario
    // No celular o "Voltar" vira só ícone: o botão principal precisa da
    // largura ("Confirmar agendamento" quebrava em duas linhas em 375px).
    ? 'shrink-0 max-md:w-12 max-md:px-0 border-borda-campo bg-transparent text-texto hover:border-ink'
    : `flex-1 md:flex-none md:px-9 border-espresso-900 bg-espresso-900 text-ivory-100 hover:bg-espresso-700 hover:border-espresso-700 ${pendente ? 'opacity-50' : ''}`;
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={ocupado}
      aria-busy={ocupado || undefined}
      aria-disabled={pendente || undefined}
      className={`${base} ${estilo}`}
    >
      {children}
    </button>
  );
}
