import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ENV_PAINEL_E2E } from '../../playwright.config';

const PAGINAS = ['/', '/sobre', '/agendar', '/politica-de-privacidade', '/termos-de-uso'];

/** Matriz do docs/01-MOBILE-FIRST.md §2 — o celular é o caso primário. */
const TELAS = [
  { nome: 'iPhone SE', width: 375, height: 667 },
  { nome: 'iPhone 15', width: 393, height: 852 },
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

  test('menu aberto no meio da página: cabeçalho e botão de fechar continuam na tela', async ({ page }) => {
    // Regressão: a trava de rolagem no <body> soltava o cabeçalho sticky
    // (html tem overflow-x: clip) e o botão de fechar saía da tela.
    await page.goto('/');
    await page.locator('#atendimento').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Abrir menu' }).click();

    await expect(page.getByRole('button', { name: 'Fechar menu' })).toBeInViewport();
    const topo = await page.getByRole('banner').evaluate((el) => el.getBoundingClientRect().top);
    expect(topo).toBe(0);

    await page.getByRole('button', { name: 'Fechar menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Principal (celular)' })).toBeHidden();
  });

  test('formulário de contato: valida os obrigatórios e abre o WhatsApp com os dados do paciente', async ({ page, context }) => {
    // O wa.me é externo: a aba abre, mas quem responde é o próprio teste.
    await context.route(/wa\.me/, (rota) => rota.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' }));
    await page.goto('/#contato');
    const form = page.getByRole('form', { name: /Prefere que o consultório fale com você/ });
    const enviar = form.getByRole('button', { name: 'Enviar pelo WhatsApp' });

    await enviar.click();
    await expect(form.getByRole('textbox', { name: /^Nome/ })).toBeFocused();
    await expect(form.getByText('Selecione o motivo da consulta.')).toBeVisible();

    await form.getByRole('textbox', { name: /^Nome/ }).fill('Maria');
    await form.getByRole('textbox', { name: /^Sobrenome/ }).fill('da Silva');
    await form.getByRole('textbox', { name: /^E-mail/ }).fill('maria@exemplo.com');
    await form.getByRole('textbox', { name: /^Idade/ }).fill('34');
    await form.getByRole('radio', { name: 'Manhã' }).check({ force: true });
    await form.getByRole('combobox', { name: /Motivo da consulta/ }).selectOption({ label: 'Performance esportiva' });
    await form.getByRole('checkbox', { name: /Autorizo o consultório/ }).check();

    const [aba] = await Promise.all([context.waitForEvent('page'), enviar.click()]);
    await aba.waitForLoadState();
    // O WhatsApp abre numa aba nova e o site CONTINUA na tela (regressão:
    // com 'noopener', window.open devolvia null e a página também navegava).
    await expect(page).toHaveURL(/\/#contato$/);
    expect(await aba.evaluate(() => window.opener)).toBeNull();
    const texto = new URL(aba.url()).searchParams.get('text') ?? '';
    expect(aba.url()).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(texto).toContain('Nome: Maria da Silva');
    expect(texto).toContain('Preferência de horário: Manhã');
    expect(texto).toContain('Motivo: Performance esportiva');
    // E o pedido ficou registrado para o painel (quando há banco de teste).
    if (process.env.DATABASE_URL_TEST) await expect(form.getByText(/ficou registrado para o consultório/)).toBeVisible();
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

test.describe('vidro (glassmorphism)', () => {
  /** Rola sem a animação do `scroll-behavior: smooth`, com o alvo logo abaixo do topo. */
  async function rolarPara(page: Page, seletor: string, folga: number) {
    await page.evaluate(([s, f]) => {
      const el = document.querySelector(s as string)!;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + (f as number), behavior: 'instant' });
    }, [seletor, folga] as const);
  }

  /** Painel de credenciais: o vidro regular mais visível da home. */
  async function estiloDoVidro(page: Page) {
    return page.getByRole('region', { name: 'Credenciais' }).getByRole('list').evaluate((el) => {
      const s = getComputedStyle(el);
      return { filtro: s.backdropFilter, fundo: s.backgroundColor };
    });
  }
  const translucido = (cor: string) => /\/\s*0?\.\d+\)$|rgba\(.*,\s*0?\.\d+\)$/.test(cor);

  test('cabeçalho: vidro claro no hero, escuro sobre a seção escura, claro de novo depois', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const cabecalho = page.getByRole('banner');
    await expect(cabecalho).toHaveAttribute('data-tom', 'claro');

    await rolarPara(page, '#atendimento', 200);
    await expect(cabecalho).toHaveAttribute('data-tom', 'escuro');
    await expect(cabecalho).toHaveAttribute('data-rolou', 'true');
    await expect(cabecalho.getByRole('link', { name: 'Agendar consulta' })).toBeVisible();

    await rolarPara(page, '#agendar', 100);
    await expect(cabecalho).toHaveAttribute('data-tom', 'claro');
  });

  test('sem preferência: vidro translúcido com desfoque', async ({ page }) => {
    await page.goto('/');
    const { filtro, fundo } = await estiloDoVidro(page);
    expect(filtro).toContain('blur(');
    expect(translucido(fundo)).toBe(true);
  });

  const PREFERENCIAS: Array<[string, (page: Page) => Promise<void>]> = [
    ['prefers-contrast: more', (page) => page.emulateMedia({ contrast: 'more' })],
    ['forced-colors: active', (page) => page.emulateMedia({ forcedColors: 'active' })],
    ['prefers-reduced-transparency: reduce', async (page) => {
      // O Playwright não expõe esta mídia; o Chromium aceita pelo protocolo.
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
      });
    }],
  ];
  for (const [nome, emular] of PREFERENCIAS) {
    test(`${nome}: o vidro vira superfície sólida, sem desfoque`, async ({ page }) => {
      await emular(page);
      await page.goto('/');
      const { filtro, fundo } = await estiloDoVidro(page);
      expect(filtro).toBe('none');
      expect(translucido(fundo)).toBe(false);
    });
  }
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

test.describe('segurança e operação (FASE-13)', () => {
  test('cabeçalhos de segurança e CSP com nonce NOVO a cada requisição', async ({ request }) => {
    const a = await request.get('/');
    const b = await request.get('/');
    const csp = a.headers()['content-security-policy']!;
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(b.headers()['content-security-policy']).not.toBe(csp);
    const h = a.headers();
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['strict-transport-security']).toContain('max-age=');
    expect(h['permissions-policy']).toContain('camera=()');
    expect(h['x-powered-by']).toBeUndefined();
  });

  test('a CSP não bloqueia nada do próprio site (console limpo e página interativa)', async ({ page }) => {
    const violacoes: string[] = [];
    page.on('console', (m) => { if (/Content Security Policy|Refused to/i.test(m.text())) violacoes.push(m.text()); });
    for (const caminho of PAGINAS) {
      await page.goto(caminho);
      await page.waitForLoadState('networkidle');
    }
    expect(violacoes).toEqual([]);
  });

  test('nenhuma requisição a domínio de terceiro no carregamento (ADR-005)', async ({ page }) => {
    const externos: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (!['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol.startsWith('http')) externos.push(u.hostname);
    });
    for (const caminho of PAGINAS) { await page.goto(caminho); await page.waitForLoadState('networkidle'); }
    expect([...new Set(externos)]).toEqual([]);
  });

  test('TRACE/TRACK recusados sem eco da requisição nem stack (pentest PT-04)', async ({ request }) => {
    // O fetch do Node (undici) recusa TRACE antes do proxy.ts: o Next responde
    // 500 genérico, sem refletir cabeçalhos (sem XST) e sem stack. Na Vercel a
    // borda responde antes. Ver docs/SEGURANCA.md.
    for (const metodo of ['TRACE', 'TRACK']) {
      const r = await request.fetch('/', { method: metodo, headers: { 'X-Eco': 'segredo-refletido' } });
      expect(r.status()).toBeGreaterThanOrEqual(400);
      const corpo = await r.text();
      expect(corpo).not.toContain('segredo-refletido');
      expect(corpo).not.toMatch(/TypeError|\n\s+at /);
    }
  });

  test('health check: público só vê o status; o detalhe exige o segredo do cron', async ({ request }) => {
    const r = await request.get('/api/health');
    expect(r.status()).toBe(200);
    const s = await r.json();
    expect(Object.keys(s)).toEqual(['status']);
    expect(['ok', 'degradado']).toContain(s.status);

    const d = await (await request.get('/api/health', { headers: { Authorization: `Bearer ${ENV_PAINEL_E2E.CRON_SECRET}` } })).json();
    expect(d).toMatchObject({ banco: true });
    expect(JSON.stringify(d)).not.toMatch(/@|\+55/);
  });

  test('prévia de link: imagem OG 1200×630 leve (WhatsApp) com nome e CRM no alt', async ({ page, request }) => {
    await page.goto('/');
    const og = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(og).toContain('/opengraph-image');
    const alt = await page.locator('meta[property="og:image:alt"]').getAttribute('content');
    expect(alt).toContain('CRM-SP');
    const img = await request.get(new URL(og!).pathname);
    expect(img.headers()['content-type']).toBe('image/png');
    expect((await img.body()).length).toBeLessThan(300 * 1024);
  });
});
