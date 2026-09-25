/**
 * Traz um elemento para dentro da área visível, respeitando
 * `prefers-reduced-motion` (sem `behavior: 'smooth'` quando reduzido).
 *
 * Usado sempre que uma mensagem de erro/aviso nasce no DOM depois de uma
 * ação — toque em "Continuar" sem escolher, sugestão de e-mail — e pode
 * nascer abaixo da dobra ou atrás de uma barra fixa/sticky (BarraAcoes,
 * NavAdminRodape), sem nenhuma pista de que existe algo a mais na tela
 * (achados UX-01/UX-02/UX-06).
 *
 * Só CLIENTE: lê `window`/`matchMedia`, então nunca roda no servidor.
 */
export function rolarParaVista(
  elemento: Element | null | undefined,
  opcoes: Omit<ScrollIntoViewOptions, 'behavior'> = { block: 'center' },
): void {
  if (!elemento) return;
  const reduzir = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  elemento.scrollIntoView({ ...opcoes, behavior: reduzir ? 'auto' : 'smooth' });
}
