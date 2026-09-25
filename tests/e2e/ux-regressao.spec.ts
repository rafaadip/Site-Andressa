/**
 * Regressão dos achados da revisão de UX/UI (celular, com barras fixas
 * sticky/fixed cobrindo conteúdo dinâmico). Contra o build de produção.
 *
 * Os testes que dependem do banco (agendamento e painel) pulam sozinhos
 * sem DATABASE_URL_TEST, como os demais arquivos de tests/e2e.
 */
import {
  test, expect, type APIRequestContext, type BrowserContext, type Page,
} from '@playwright/test';
import { marcar } from './util';
import { randomUUID } from 'node:crypto';
import { criarSessao } from '@/lib/auth/sessao';
import { ENV_PAINEL_E2E } from '../../playwright.config';

const BASE = 'http://localhost:3100';
const TIPO = 'consulta-presencial';

const ip = () => `10.8.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

async function entrar(context: BrowserContext) {
  await context.addCookies([{
    name: 'admin_sessao',
    value: criarSessao(ENV_PAINEL_E2E.ADMIN_EMAIL, Date.now(), ENV_PAINEL_E2E.AUTH_SECRET),
    url: BASE, httpOnly: true, sameSite: 'Lax',
  }]);
}

/**
 * Agenda uma consulta pela API, longe dos outros testes (do FIM da janela
 * de disponibilidade — admin.spec.ts já usa os deslocamentos 0, 1 e 2 a
 * partir do fim; aqui usamos 3+ para não disputar o mesmo horário).
 */
async function agendarLonge(
  request: APIRequestContext,
  deslocamento: number,
  extra: Partial<{ motivo: string; consentimentoSaude: boolean }> = {},
) {
  const de = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
  const ate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const disp = await (await request.get(`/api/disponibilidade?tipo=${TIPO}&de=${de}&ate=${ate}`)).json();
  const slots = disp.dias.flatMap((d: { slots: { inicio: string }[] }) => d.slots) as { inicio: string }[];
  const inicio = slots[slots.length - 1 - deslocamento]!.inicio;
  // Só letras: nome com dígito é recusado (SEC-05).
  const nome = `Paciente Ux ${randomUUID().slice(0, 5).replace(/\d/g, (d) => 'ghijklmnop'[Number(d)]!)}`;
  const r = await request.post('/api/agendamentos', {
    headers: { 'Idempotency-Key': randomUUID(), 'x-forwarded-for': ip() },
    data: {
      tipo: TIPO, inicio, site: '',
      paciente: {
        nome, telefone: '11987654321', email: `ux.${randomUUID().slice(0, 8)}@exemplo.com`,
        consentimentoDados: true, ...extra,
      },
    },
  });
  expect(r.status()).toBe(201);
  const corpo = await r.json();
  return { id: corpo.id as string, urlGestao: corpo.urlGestao as string, nome };
}

/** Preenche e confirma a etapa 3, pelo formulário (não pela API): é a UI que gera a Confirmacao. */
async function completarPelaUi(page: Page) {
  await page.goto('/agendar');
  await marcar(page.getByRole('radio', { name: /Consulta presencial/ }));
  await page.getByRole('button', { name: /Continuar/ }).click();
  await expect(page.getByRole('radiogroup', { name: 'Dia da consulta' })).toBeVisible();

  // Último horário do dia (não o primeiro): agendamento.spec.ts disputa o
  // primeiro repetidamente; pegar o último reduz a chance de colisão.
  const slots = page.locator('[aria-labelledby="rotulo-horarios"] [role="radio"]');
  await slots.last().click();
  await page.getByRole('button', { name: /Continuar/ }).click();

  await page.getByRole('textbox', { name: /Nome completo/ }).fill('Marina Teste');
  await page.getByRole('textbox', { name: /Celular/ }).fill('11912345678');
  await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(`ux.${randomUUID().slice(0, 8)}@exemplo.com`);
  await page.getByRole('checkbox', { name: /Autorizo o uso do meu nome/ }).check();
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
  await expect(page.getByRole('heading', { name: /Consulta confirmada/ })).toBeVisible();
}

test.describe('sem banco necessário', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });

  test('UX-04: "Fale pelo WhatsApp" (Home) tem alvo de toque ≥ 44px', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: 'Fale pelo WhatsApp' });
    await link.scrollIntoViewIfNeeded();
    const box = await link.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('agendamento (precisa de banco)', () => {
  test.skip(!process.env.DATABASE_URL_TEST, 'Sem DATABASE_URL_TEST — agendamento não testável.');
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, extraHTTPHeaders: { 'x-forwarded-for': ip() } });

  test('UX-01: erro de modalidade fica visível ao tocar Continuar sem escolher', async ({ page }) => {
    await page.goto('/agendar');
    // `aria-disabled` (não `disabled`): continua tocável de propósito, para
    // explicar o que falta. O Playwright só clica nele com `force`.
    await page.getByRole('button', { name: /Continuar/ }).click({ force: true });
    await expect(page.locator('#erro-modalidade')).toBeInViewport();
  });

  test('UX-03: campo "Link da sua consulta" tem font-size ≥ 16px (sem zoom no iOS)', async ({ page }) => {
    await completarPelaUi(page);
    const link = page.getByRole('textbox', { name: 'Link da sua consulta' });
    await expect(link).toBeVisible();
    const fontSize = await link.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(16);
  });

  test('UX-04: "Agende pelo WhatsApp" (rodapé das etapas) tem alvo de toque ≥ 44px', async ({ page }) => {
    await page.goto('/agendar');
    const link = page.getByRole('link', { name: 'Agende pelo WhatsApp' });
    await link.scrollIntoViewIfNeeded();
    const box = await link.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('UX-05: apagar o motivo exige 2 toques, com "Manter" como saída', async ({ page, request }) => {
    const c = await agendarLonge(request, 3, { motivo: 'Resultado de exames recentes', consentimentoSaude: true });
    await page.goto(c.urlGestao);

    const tituloMotivo = page.getByRole('heading', { name: 'Motivo da consulta' });
    await expect(tituloMotivo).toBeVisible();

    // 1º toque: só abre a confirmação, não apaga.
    await page.getByRole('button', { name: 'Apagar o motivo que escrevi' }).click();
    await expect(page.getByText('Apagar o motivo que você escreveu?')).toBeVisible();
    await expect(tituloMotivo).toBeVisible();

    // "Manter o motivo" cancela sem apagar.
    await page.getByRole('button', { name: 'Manter o motivo' }).click();
    await expect(tituloMotivo).toBeVisible();

    // 2º toque, agora confirmando: aí sim apaga.
    await page.getByRole('button', { name: 'Apagar o motivo que escrevi' }).click();
    await page.getByRole('button', { name: 'Sim, apagar' }).click();
    await expect(tituloMotivo).toHaveCount(0);
  });
});

test.describe('painel (precisa de banco)', () => {
  test.skip(!process.env.DATABASE_URL_TEST, 'Sem DATABASE_URL_TEST — painel não testável.');
  test.use({ viewport: { width: 375, height: 667 } });

  test('UX-02: "Remarcar" fica visível (não sob a barra fixa) após scrollIntoViewIfNeeded', async ({ page, context, request }) => {
    const c = await agendarLonge(request, 4);
    await entrar(context);
    await page.goto(`/admin/consulta/${c.id}`);

    const remarcar = page.getByRole('link', { name: 'Remarcar' });
    await remarcar.scrollIntoViewIfNeeded();
    await expect(remarcar).toBeInViewport();

    const barra = page.getByRole('navigation', { name: 'Painel (celular)' });
    const [remarcarBox, barraBox] = await Promise.all([remarcar.boundingBox(), barra.boundingBox()]);
    // O rodapé do link não pode invadir a faixa coberta pela barra fixa.
    expect(remarcarBox!.y + remarcarBox!.height).toBeLessThanOrEqual(barraBox!.y);
  });
});
