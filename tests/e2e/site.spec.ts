import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGINAS = ['/', '/sobre', '/agendar', '/politica-de-privacidade', '/termos-de-uso'];

/** Matriz do docs/01-MOBILE-FIRST.md §2 — o celular é o caso primário. */
const TELAS = [
  { nome: 'iPhone SE', width: 375, height: 667 },
  { nome: 'iPhone Pro Max', width: 430, height: 932 },
  { nome: 'iPad retrato', width: 768, height: 1024 },
  { nome: 'iPad paisagem', width: 1024, height: 768 },
  { nome: 'desktop', width: 1440, height: 900 },
];

async function rolagemHorizontal(page: Page) {
  return page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

for (const tela of TELAS) {
  test.describe(`${tela.nome} (${tela.width}px)`, () => {
    test.use({ viewport: { width: tela.width, height: tela.height } });

    for (const caminho of PAGINAS) {
      test(`${caminho}: sem rolagem horizontal`, async ({ page }) => {
        await page.goto(caminho);
        expect(await rolagemHorizontal(page)).toBe(0);
      });
    }
  });
}

test.describe('acessibilidade (axe, WCAG 2.2 AA)', () => {
  for (const caminho of PAGINAS) {
    for (const largura of [375, 1440]) {
      test(`${caminho} em ${largura}px`, async ({ page }) => {
        await page.setViewportSize({ width: largura, height: 900 });
        await page.goto(caminho);
        const r = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        const resumo = r.violations.map((v) => `${v.id}: ${v.nodes.length}× — ${v.help}`);
        expect(resumo).toEqual([]);
      });
    }
  }
});

test.describe('estrutura e conformidade', () => {
  for (const caminho of PAGINAS) {
    test(`${caminho}: um único h1, nome e CRM visíveis`, async ({ page }) => {
      await page.goto(caminho);
      await expect(page.locator('h1')).toHaveCount(1);
      // CFM: identificação em TODA página pública.
      await expect(page.locator('footer')).toContainText('Dra. Andressa Chaves Correia');
      await expect(page.locator('footer')).toContainText('CRM-SP 267.777');
    });
  }

  test('nenhuma página alega especialidade', async ({ page }) => {
    for (const caminho of PAGINAS) {
      await page.goto(caminho);
      const texto = (await page.locator('body').innerText()).toLowerCase();
      expect(texto, caminho).not.toContain('especialista');
      expect(texto, caminho).not.toContain('nutróloga');
    }
  });

  test('sem endereço definido, nada vaza "undefined"', async ({ page }) => {
    for (const caminho of PAGINAS) {
      await page.goto(caminho);
      const html = await page.content();
      expect(html, caminho).not.toMatch(/>\s*(undefined|null)\s*</);
    }
  });
});

test.describe('celular (375px)', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });

  test('CTA "Agendar consulta" do hero está acima da dobra', async ({ page }) => {
    await page.goto('/');
    const cta = page.locator('#inicio').getByRole('link', { name: 'Agendar consulta' });
    const caixa = await cta.boundingBox();
    expect(caixa).not.toBeNull();
    expect(caixa!.y + caixa!.height).toBeLessThanOrEqual(667);
  });

  test('alvos de toque interativos têm pelo menos 44px de altura', async ({ page }) => {
    await page.goto('/');
    const pequenos = await page.evaluate(() => {
      const alvos = [...document.querySelectorAll<HTMLElement>('main a, main button, main summary, header button, footer a')];
      return alvos
        .filter((el) => {
          // links dentro de frase são isentos (WCAG 2.5.8, exceção "inline")
          const inline = getComputedStyle(el).display === 'inline';
          const r = el.getBoundingClientRect();
          return !inline && r.width > 0 && r.height < 44;
        })
        .map((el) => `${el.tagName} "${el.textContent?.trim().slice(0, 30)}" = ${Math.round(el.getBoundingClientRect().height)}px`);
    });
    expect(pequenos).toEqual([]);
  });

  test('menu: abre, prende o foco, fecha com Esc e devolve o foco', async ({ page }) => {
    await page.goto('/');
    const botao = page.getByRole('button', { name: 'Abrir menu' });
    await botao.click();
    await expect(page.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: 'Principal (celular)' }).getByRole('link').first()).toBeFocused();

    // O painel APARECE de fato, cobrindo a tela abaixo do cabeçalho — um
    // `fixed` dentro de elemento com backdrop-filter chegou a ter altura 0.
    const painel = await page.getByRole('navigation', { name: 'Principal (celular)' }).boundingBox();
    expect(painel!.height).toBeGreaterThan(500);
    await expect(page.getByRole('navigation', { name: 'Principal (celular)' }).getByRole('link', { name: 'Agendar consulta' })).toBeInViewport();

    // Tab não escapa do painel: dá a volta.
    for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
    const dentro = await page.evaluate(() => {
      const ativo = document.activeElement;
      const painel = document.querySelector('nav[aria-label="Principal (celular)"]');
      return !!ativo && (painel?.contains(ativo) || ativo.getAttribute('aria-controls') !== null);
    });
    expect(dentro).toBe(true);

    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeFocused();
    await expect(page.getByRole('navigation', { name: 'Principal (celular)' })).toBeHidden();
  });

  test('barra de agendar: escondida no topo, aparece ao rolar, some na seção de agendamento', async ({ page }) => {
    await page.goto('/');
    const barra = page.getByTestId('barra-agendar');

    await expect(barra).toHaveAttribute('aria-hidden', 'true');

    await page.locator('#nutrologia').scrollIntoViewIfNeeded();
    await expect(barra).toHaveAttribute('aria-hidden', 'false');
    await expect(barra.getByRole('link', { name: 'Agendar consulta' })).toBeInViewport();

    await page.locator('#agendar').scrollIntoViewIfNeeded();
    await expect(barra).toHaveAttribute('aria-hidden', 'true');
  });

  test('campos e textos não ficam abaixo de 16px no corpo', async ({ page }) => {
    await page.goto('/');
    const corpo = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
    expect(corpo).toBeGreaterThanOrEqual(16);
  });
});

test.describe('SEO', () => {
  test('home publica JSON-LD de Physician e FAQPage válidos', async ({ page }) => {
    await page.goto('/');
    const blocos = await page.locator('script[type="application/ld+json"]').allTextContents();
    const tipos = blocos.map((b) => JSON.parse(b)['@type']);
    expect(tipos).toEqual(expect.arrayContaining(['Physician', 'FAQPage']));
  });

  test('sitemap não expõe rotas privadas', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    expect(xml).toContain('/agendar');
    expect(xml).not.toContain('/admin');
    expect(xml).not.toContain('/consulta/');
  });
});
