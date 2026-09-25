import { expect, type Locator } from '@playwright/test';

/**
 * Marca uma opção (`role="radio"`) e só segue quando ela ficou marcada.
 *
 * As opções são botões com `onClick`: antes de o React hidratar não há
 * listener, e um toque nesse intervalo se perde. O CI pegou isso no 1º
 * teste depois de o servidor subir — o `aria-checked` nunca virou `true`
 * e a etapa 2 não apareceu. Repete a ação até a marcação "pegar".
 */
export async function marcar(opcao: Locator, acao: (l: Locator) => Promise<void> = (l) => l.click()) {
  await expect(async () => {
    await acao(opcao);
    await expect(opcao).toHaveAttribute('aria-checked', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}
