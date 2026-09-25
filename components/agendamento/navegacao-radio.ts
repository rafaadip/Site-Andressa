import type { KeyboardEvent } from 'react';

/**
 * Setas em `role="radiogroup"`: comportamento esperado de grupo de rádio
 * (WAI-ARIA APG). A seta move o foco E seleciona; opções com
 * aria-disabled são puladas; Home/End vão às pontas.
 */
export function navegarRadio(e: KeyboardEvent<HTMLElement>) {
  const avancar = e.key === 'ArrowRight' || e.key === 'ArrowDown';
  const voltar = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
  if (!avancar && !voltar && e.key !== 'Home' && e.key !== 'End') return;

  const radios = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])')];
  if (radios.length === 0) return;
  const atual = radios.indexOf(document.activeElement as HTMLElement);

  let alvo: HTMLElement | undefined;
  if (e.key === 'Home') alvo = radios[0];
  else if (e.key === 'End') alvo = radios[radios.length - 1];
  // Foco no próprio grupo (focarGrupo() depois de um erro): nenhuma opção
  // é a "atual" — seta para a frente vai à primeira, para trás à última.
  else if (atual === -1) alvo = avancar ? radios[0] : radios[radios.length - 1];
  else if (avancar) alvo = radios[(atual + 1) % radios.length];
  else alvo = radios[(atual - 1 + radios.length) % radios.length];

  e.preventDefault();
  alvo?.focus();
  alvo?.click();
}
