/**
 * Uso real por aparelho — iPhone, Galaxy, tablet e web (emulação no
 * Chromium: viewport, densidade de pixels, toque e user agent).
 *
 * ⚠️ Emulação não é o WebKit do Safari: teclado virtual, barra de endereço
 * que some e barra de gestos só aparecem no aparelho real
 * (docs/ROTEIRO-TESTE-MANUAL.md). Aqui garantimos que cada jornada
 * principal funciona NO TOQUE, em cada formato de tela.
 */
import { test, expect, devices, type Page, type BrowserContext } from '@playwright/test';
import { marcar } from './util';
import { randomUUID } from 'node:crypto';
import { criarSessao } from '@/lib/auth/sessao';
import { ENV_PAINEL_E2E } from '../../playwright.config';

test.skip(!process.env.DATABASE_URL_TEST, 'Sem DATABASE_URL_TEST — jornadas de agendamento não testáveis.');
// Disputam os mesmos horários: em série.
test.describe.configure({ mode: 'serial' });

/** Descritor sem `defaultBrowserType` (só dá para trocar de motor por projeto). */
function aparelho(nome: string) {
  const { defaultBrowserType: _motor, ...resto } = devices[nome]!;
  return resto;
}

const APARELHOS = [
  { nome: 'iPhone SE (320 px — reflow WCAG)', d: aparelho('iPhone SE'), celular: true },
  { nome: 'iPhone 15', d: aparelho('iPhone 15'), celular: true },
  { nome: 'iPhone 15 Pro Max', d: aparelho('iPhone 15 Pro Max'), celular: true },
  { nome: 'Galaxy S24', d: aparelho('Galaxy S24'), celular: true },
  { nome: 'Galaxy S9+', d: aparelho('Galaxy S9+'), celular: true },
  { nome: 'Galaxy Tab S4', d: aparelho('Galaxy Tab S4'), celular: false },
  { nome: 'iPad retrato', d: aparelho('iPad (gen 7)'), celular: false },
  { nome: 'iPad paisagem', d: aparelho('iPad (gen 7) landscape'), celular: false },
  { nome: 'Desktop Chrome', d: aparelho('Desktop Chrome'), celular: false },
];

const ip = () => `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

async function semRolagemHorizontal(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
}

/** Toque quando o aparelho tem tela de toque; clique no desktop. */
async function tocar(page: Page, alvo: ReturnType<Page['locator']>) {
  const toque = await page.evaluate(() => navigator.maxTouchPoints > 0);
  if (toque) await alvo.tap(); else await alvo.click();
}

async function entrarNoPainel(context: BrowserContext) {
  await context.addCookies([{
    name: 'admin_sessao', value: criarSessao(ENV_PAINEL_E2E.ADMIN_EMAIL, Date.now(), ENV_PAINEL_E2E.AUTH_SECRET),
    url: 'http://localhost:3100', httpOnly: true, sameSite: 'Lax',
  }]);
}

for (const a of APARELHOS) {
  test.describe(a.nome, () => {
    test.use({ ...a.d, extraHTTPHeaders: { 'x-forwarded-for': ip() } });

    test('home: carrega, cabe na tela e a ação principal é alcançável', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await semRolagemHorizontal(page);
      const cta = page.locator('#inicio').getByRole('link', { name: /Agendar consulta/ });
      await expect(cta).toBeVisible();
      if (a.celular) await expect(cta).toBeInViewport();
    });

    test('navegação: menu (celular/tablet) ou links (desktop) levam às seções', async ({ page }) => {
      await page.goto('/');
      const botao = page.getByRole('button', { name: 'Abrir menu' });
      if (await botao.isVisible()) {
        await tocar(page, botao);
        const painel = page.getByRole('navigation', { name: 'Principal (celular)' });
        await expect(painel).toBeVisible();
        expect((await painel.boundingBox())!.height).toBeGreaterThan(300);
        await tocar(page, painel.getByRole('link', { name: 'Sobre' }));
        await expect(painel).toBeHidden();
      } else {
        await page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Sobre' }).click();
      }
      await expect(page).toHaveURL(/#sobre$/);
    });

    test('agendamento completo no toque, e cancelamento pelo link', async ({ page }) => {
      await page.goto('/agendar');
      await marcar(page.getByRole('radio', { name: /Consulta presencial/ }), (l) => tocar(page, l));
      await tocar(page, page.getByRole('button', { name: /Continuar/ }));
      // Um dia do MEIO da janela e o último horário dele: os outros specs,
      // em paralelo, disputam os primeiros dias e o fim da janela.
      await tocar(page, page.getByRole('radiogroup', { name: 'Dia da consulta' }).getByRole('radio', { disabled: false }).nth(4));
      const slot = page.locator('[aria-labelledby="rotulo-horarios"] [role="radio"]').last();
      await expect(slot).toBeVisible();
      await semRolagemHorizontal(page);
      await tocar(page, slot);
      await tocar(page, page.getByRole('button', { name: /Continuar/ }));

      await page.getByRole('textbox', { name: /Nome completo/ }).fill('Carla Mendes');
      await page.getByRole('textbox', { name: /Celular/ }).fill('11987651234');
      await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(`disp.${randomUUID().slice(0, 8)}@exemplo.com`);
      await tocar(page, page.getByRole('checkbox', { name: /Autorizo o uso do meu nome/ }));
      const confirmar = page.getByRole('button', { name: 'Confirmar agendamento' });
      // A ação principal não fica escondida sob a barra fixa nem fora da tela.
      await confirmar.scrollIntoViewIfNeeded();
      await expect(confirmar).toBeInViewport();
      await tocar(page, confirmar);

      await expect(page.getByRole('heading', { name: /Consulta confirmada, Carla/ })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Google Agenda' })).toBeVisible();
      await semRolagemHorizontal(page);

      await page.goto(await page.getByRole('textbox', { name: 'Link da sua consulta' }).inputValue());
      await tocar(page, page.getByRole('button', { name: 'Cancelar consulta' }));
      await tocar(page, page.getByRole('button', { name: 'Sim, cancelar' }));
      await expect(page.getByRole('heading', { name: 'Consulta cancelada', level: 1 })).toBeVisible();
    });

    test('painel da médica: navegação no lugar certo para o formato', async ({ page, context }) => {
      await entrarNoPainel(context);
      await page.goto('/admin');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await semRolagemHorizontal(page);
      const viewport = page.viewportSize()!;
      if (viewport.width < 768) {
        const nav = await page.getByRole('navigation', { name: 'Painel (celular)' }).boundingBox();
        expect(Math.round(nav!.y + nav!.height)).toBe(viewport.height);    // polegar
        await tocar(page, page.getByRole('navigation', { name: 'Painel (celular)' }).getByRole('link', { name: 'Horários' }));
      } else {
        await page.getByRole('navigation', { name: 'Painel', exact: true }).getByRole('link', { name: 'Horários' }).click();
      }
      await expect(page.getByRole('heading', { name: 'Horários de atendimento' })).toBeVisible();
      await semRolagemHorizontal(page);
    });
  });
}
