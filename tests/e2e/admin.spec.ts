/**
 * E2E do painel (FASE-09) — contra o build de produção e Postgres real.
 *
 * O login de verdade passa pelo Google; aqui a sessão é ASSINADA com o
 * mesmo AUTH_SECRET do servidor de teste (playwright.config.ts), o que
 * também prova que cookie forjado ou de outra conta não entra.
 */
import { test, expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { criarSessao } from '@/lib/auth/sessao';
import { ENV_PAINEL_E2E } from '../../playwright.config';

test.skip(!process.env.DATABASE_URL_TEST, 'Sem DATABASE_URL_TEST — painel não testável.');
test.describe.configure({ mode: 'serial' });

const BASE = 'http://localhost:3100';

async function entrar(context: BrowserContext, email: string = ENV_PAINEL_E2E.ADMIN_EMAIL, segredo: string = ENV_PAINEL_E2E.AUTH_SECRET) {
  await context.addCookies([{ name: 'admin_sessao', value: criarSessao(email, Date.now(), segredo), url: BASE, httpOnly: true, sameSite: 'Lax' }]);
}

const ip = () => `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

/** Agenda uma consulta pela API num dia bem à frente (longe dos outros testes). */
async function agendarLonge(request: APIRequestContext, deslocamento = 0) {
  const de = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
  const ate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const disp = await (await request.get(`/api/disponibilidade?tipo=consulta-presencial&de=${de}&ate=${ate}`)).json();
  const slots = disp.dias.flatMap((d: { slots: { inicio: string }[] }) => d.slots) as { inicio: string }[];
  const inicio = slots[slots.length - 1 - deslocamento]!.inicio;       // do fim: longe dos outros testes
  // Só letras: nome com dígito é recusado (SEC-05). a–f do UUID + g–p no lugar dos dígitos.
  const nome = `Paciente ${randomUUID().slice(0, 5).replace(/\d/g, (d) => 'ghijklmnop'[Number(d)]!)}`;
  const r = await request.post('/api/agendamentos', {
    headers: { 'Idempotency-Key': randomUUID(), 'x-forwarded-for': ip() },
    data: { tipo: 'consulta-presencial', inicio, site: '', paciente: { nome, telefone: '11987654321', email: `adm.${randomUUID().slice(0, 8)}@exemplo.com`, consentimentoDados: true } },
  });
  expect(r.status()).toBe(201);
  const corpo = await r.json();
  return { id: corpo.id as string, inicio, nome, urlGestao: corpo.urlGestao as string };
}

async function semRolagemHorizontal(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
}

test.describe('acesso', () => {
  test('sem sessão, qualquer /admin vai para o login — que não é indexável', async ({ page }) => {
    for (const rota of ['/admin', '/admin/disponibilidade', '/admin/privacidade']) {
      await page.goto(rota);
      await expect(page).toHaveURL(/\/admin\/entrar$/);
    }
    await expect(page.getByRole('link', { name: 'Entrar com Google' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('sessão de outra conta, ou assinada com outro segredo, NÃO entra (allowlist)', async ({ page, context }) => {
    await entrar(context, 'outra.pessoa@exemplo.com');
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/entrar$/);
    await context.clearCookies();
    await entrar(context, ENV_PAINEL_E2E.ADMIN_EMAIL, 'outro-segredo-qualquer-com-mais-de-32-chars');
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/entrar$/);
  });

  test('exportação de dados e ações de cron exigem credencial', async ({ request }) => {
    const exp = await request.get('/admin/exportar?email=x@exemplo.com', { maxRedirects: 0 });
    expect([307, 401]).toContain(exp.status());
    expect((await request.get('/api/cron/reconciliar')).status()).toBe(401);
    expect((await request.get('/api/cron/reconciliar', { headers: { Authorization: 'Bearer errado' } })).status()).toBe(401);
    const ok = await request.get('/api/cron/reconciliar', { headers: { Authorization: `Bearer ${ENV_PAINEL_E2E.CRON_SECRET}` } });
    expect(ok.status()).toBe(200);
  });
});

test.describe('celular (375px), com uma mão', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('todas as telas: sem rolagem horizontal, navegação no rodapé e sem violação de acessibilidade', async ({ page, context }) => {
    await entrar(context);
    for (const rota of ['/admin', '/admin/disponibilidade', '/admin/disponibilidade/bloquear', '/admin/integracoes', '/admin/configuracoes', '/admin/privacidade']) {
      await page.goto(rota);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await semRolagemHorizontal(page);
      // Barra de navegação presa EMBAIXO (alcance do polegar) e cabeçalho visível no topo.
      const nav = await page.getByRole('navigation', { name: 'Painel (celular)' }).boundingBox();
      expect(Math.round(nav!.y + nav!.height)).toBe(667);
      await expect(page.getByRole('link', { name: /^Painel/ })).toBeInViewport();
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(r.violations, `${rota}: ${r.violations.map((v) => v.id).join(', ')}`).toEqual([]);
    }
  });

  test('"Bloquear o resto de hoje" em UM toque a partir da agenda — e desfazer', async ({ page, context }) => {
    await entrar(context);
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Bloquear o resto de hoje' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'resto de hoje está bloqueado' })).toBeVisible();

    await page.getByRole('navigation', { name: 'Painel (celular)' }).getByRole('link', { name: 'Horários' }).click();
    const remover = page.getByRole('button', { name: /^Remover bloqueio/ });
    await expect(remover).toHaveCount(1);
    await remover.click();
    await expect(page.getByRole('button', { name: /^Remover bloqueio/ })).toHaveCount(0);
  });

  test('bloquear período com consulta dentro exige decisão; cancelar avisa e libera o link do paciente', async ({ page, context, request }) => {
    const c = await agendarLonge(request);
    await entrar(context);
    await page.goto(`/admin/disponibilidade/bloquear?de=${c.inicio.slice(0, 10)}&diaInteiro=on&nota=Congresso`);
    const grupo = page.getByRole('group', { name: new RegExp(c.nome) });
    await expect(grupo).toBeVisible();

    // Sem decidir, o navegador não deixa enviar (e o servidor também recusaria).
    await page.getByRole('button', { name: 'Confirmar bloqueio' }).click();
    await expect(page).toHaveURL(/\/bloquear\?/);

    await grupo.getByRole('radio', { name: /Cancelar e avisar/ }).check();
    await page.getByRole('button', { name: 'Confirmar bloqueio' }).click();
    await expect(page).toHaveURL(/\/admin\/disponibilidade\?feito=bloqueado/);

    await page.goto(c.urlGestao);
    await expect(page.getByRole('heading', { name: 'Consulta cancelada' })).toBeVisible();

    await page.goto('/admin/disponibilidade');
    await page.getByRole('button', { name: /^Remover bloqueio/ }).first().click();
  });

  test('remarcar e cancelar pelo detalhe da consulta', async ({ page, context, request }) => {
    const c = await agendarLonge(request, 1);
    await entrar(context);
    await page.goto(`/admin/consulta/${c.id}`);
    await expect(page.getByRole('heading', { level: 1, name: c.nome })).toBeVisible();
    await expect(page.getByRole('link', { name: /\(11\) 98765-4321/ })).toHaveAttribute('href', /^tel:/);

    await page.getByRole('link', { name: 'Remarcar' }).click();
    await page.locator('label:has(input[name="inicio"])').first().click();
    await page.getByRole('button', { name: 'Remarcar e avisar o paciente' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Consulta remarcada' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar consulta…' }).click();
    await expect(page.getByRole('textbox', { name: /Recado ao paciente/ })).toBeFocused();
    await page.getByRole('textbox', { name: /Recado ao paciente/ }).fill('Surgiu um compromisso. Peço desculpas.');
    await page.getByRole('button', { name: 'Sim, cancelar' }).click();
    await expect(page).toHaveURL(/\/admin\?feito=cancelada/);
  });

  test('semana padrão: faixa inválida é recusada com mensagem clara', async ({ page, context }) => {
    await entrar(context);
    await page.goto('/admin/disponibilidade');
    const domingo = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Domingo' }) });
    await domingo.getByRole('button', { name: 'Adicionar faixa' }).click();
    await domingo.getByLabel('Das').fill('12:00');
    await domingo.getByLabel('às').fill('09:00');
    await domingo.getByRole('button', { name: 'Salvar domingo' }).click();
    await expect(domingo.getByRole('alert')).toContainText('termina antes de começar');
  });

  test('privacidade: busca o titular e exporta os dados dele', async ({ page, context, request }) => {
    const c = await agendarLonge(request, 2);
    await entrar(context);
    const detalhe = await (await context.request.get(`/admin/consulta/${c.id}`)).text();
    const email = /mailto:([^"]+)"/.exec(detalhe)![1]!;
    await page.goto(`/admin/privacidade?email=${encodeURIComponent(email)}`);
    await expect(page.getByRole('heading', { name: '1 consulta(s) com dados' })).toBeVisible();
    const exp = await context.request.get(`/admin/exportar?email=${encodeURIComponent(email)}&formato=json`);
    expect(exp.status()).toBe(200);
    expect((await exp.json()).consultas[0].nome).toBe(c.nome);
    // limpa: cancela para não ocupar a agenda dos outros testes
    await page.goto(`/admin/consulta/${c.id}`);
    await page.getByRole('button', { name: 'Cancelar consulta…' }).click();
    await page.getByRole('button', { name: 'Sim, cancelar' }).click();
    await expect(page).toHaveURL(/feito=cancelada/);
  });
});
