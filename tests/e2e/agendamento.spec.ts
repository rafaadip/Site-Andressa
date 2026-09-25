/**
 * E2E do fluxo de agendamento — contra o build de produção e Postgres real.
 * Pula sem DATABASE_URL_TEST.
 */
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';

test.skip(!process.env.DATABASE_URL_TEST, 'Sem DATABASE_URL_TEST — agendamento não testável.');

// Os testes disputam os MESMOS horários: em série, para não se atrapalharem.
test.describe.configure({ mode: 'serial' });

/** IP simulado por teste: todos saem do localhost e esbarrariam no limite de 5/hora. */
function ipAleatorio() {
  return `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
}
test.use({ extraHTTPHeaders: { 'x-forwarded-for': ipAleatorio() } });

const email = () => `e2e.${randomUUID().slice(0, 8)}@exemplo.com`;

async function irParaHorarios(page: Page, modalidade = /Consulta presencial/) {
  await page.goto('/agendar');
  await page.getByRole('radio', { name: modalidade }).click();
  await page.getByRole('button', { name: /Continuar/ }).click();
  await expect(page.getByRole('radiogroup', { name: 'Dia da consulta' })).toBeVisible();
}

async function escolherHorario(page: Page, indice = 0) {
  const slots = page.locator('[aria-labelledby="rotulo-horarios"] [role="radio"]');
  await slots.nth(indice).click();
  await expect(slots.nth(indice)).toHaveAttribute('aria-checked', 'true');
  return (await slots.nth(indice).innerText()).trim().slice(0, 5);
}

async function preencher(page: Page, dados: { nome?: string; tel?: string; email?: string; motivo?: string } = {}) {
  await page.getByRole('textbox', { name: /Nome completo/ }).fill(dados.nome ?? 'Ana Souza');
  await page.getByRole('textbox', { name: /Celular/ }).fill(dados.tel ?? '11912345678');
  await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill(dados.email ?? email());
  if (dados.motivo) await page.getByRole('textbox', { name: /Motivo/ }).fill(dados.motivo);
  await page.getByRole('checkbox', { name: /Autorizo o uso do meu nome/ }).check();
}

/** Primeiro horário livre a mais de `horas` daqui, pela API. */
async function slotLivre(request: APIRequestContext, horas = 0) {
  const hoje = new Date().toISOString().slice(0, 10);
  const r = await (await request.get(`/api/disponibilidade?tipo=consulta-presencial&de=${hoje}&ate=${
    new Date(Date.now() + 13 * 86_400_000).toISOString().slice(0, 10)}`)).json();
  const limite = Date.now() + horas * 3_600_000;
  for (const d of r.dias) for (const s of d.slots) if (new Date(s.inicio).getTime() > limite) return s.inicio as string;
  throw new Error('sem horário livre');
}

async function agendarPelaApi(request: APIRequestContext, inicio: string) {
  const r = await request.post('/api/agendamentos', {
    headers: { 'Idempotency-Key': randomUUID(), 'x-forwarded-for': ipAleatorio() },
    data: {
      tipo: 'consulta-presencial', inicio, site: '',
      paciente: { nome: 'Outra Pessoa', telefone: '11987654321', email: email(), consentimentoDados: true },
    },
  });
  expect(r.status()).toBe(201);
  return r.json();
}

test.describe('celular (375px)', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });

  test('agenda do início ao fim e sai com o compromisso na mão', async ({ page, request }) => {
    await irParaHorarios(page);
    const hora = await escolherHorario(page);
    await page.getByRole('button', { name: /Continuar/ }).click();

    // Resumo fixo com o que foi escolhido (WCAG 3.3.7: não pergunta de novo).
    await expect(page.getByText(`às ${hora}`)).toBeVisible();

    await preencher(page);
    await page.getByRole('button', { name: 'Confirmar agendamento' }).click();

    const titulo = page.getByRole('heading', { name: /Consulta confirmada, Ana/ });
    await expect(titulo).toBeVisible();
    await expect(titulo).toBeFocused();

    // .ics real e válido
    const ics = page.getByRole('link', { name: 'iPhone, Outlook e outros' });
    const resp = await request.get((await ics.getAttribute('href'))!);
    expect(resp.headers()['content-type']).toContain('text/calendar');
    expect(await resp.text()).toContain('METHOD:REQUEST');

    // o link de gestão funciona
    const gestao = await page.getByRole('textbox', { name: 'Link da sua consulta' }).inputValue();
    await page.goto(gestao);
    await expect(page.getByRole('heading', { name: 'Consulta confirmada', level: 1 })).toBeVisible();

    // LGPD/ADR-005: agendar do começo ao fim não deixa cookie NENHUM no paciente.
    expect(await page.context().cookies()).toEqual([]);
  });

  test('sem rolagem horizontal e com a ação principal visível em cada etapa', async ({ page }) => {
    const semRolagem = () => page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);

    await page.goto('/agendar');
    expect(await semRolagem()).toBe(0);
    await page.getByRole('radio', { name: /Consulta presencial/ }).click();
    await expect(page.getByRole('button', { name: /Continuar/ })).toBeInViewport();

    await page.getByRole('button', { name: /Continuar/ }).click();
    await expect(page.getByRole('radiogroup', { name: 'Dia da consulta' })).toBeVisible();
    expect(await semRolagem()).toBe(0);
    // barra de ações presa ao rodapé: visível sem rolar
    await expect(page.getByRole('button', { name: /Continuar/ })).toBeInViewport();

    await escolherHorario(page);
    await page.getByRole('button', { name: /Continuar/ }).click();
    expect(await semRolagem()).toBe(0);

    // "Confirmar agendamento" numa linha só (antes quebrava em duas)
    const confirmar = page.getByRole('button', { name: 'Confirmar agendamento' });
    await expect(confirmar).toBeInViewport();
    expect((await confirmar.boundingBox())!.height).toBeLessThanOrEqual(52);
  });

  test('validação: foco no 1º erro; consentimento de saúde só aparece com motivo', async ({ page }) => {
    await irParaHorarios(page);
    await escolherHorario(page);
    await page.getByRole('button', { name: /Continuar/ }).click();

    await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
    await expect(page.getByRole('textbox', { name: /Nome completo/ })).toBeFocused();
    await expect(page.getByText('Informe nome e sobrenome.')).toBeVisible();

    const saude = page.getByRole('checkbox', { name: /informação de saúde/ });
    await expect(saude).toHaveCount(0);
    await page.getByRole('textbox', { name: /Motivo/ }).fill('Resultado de exames');
    await expect(saude).toBeVisible();

    await preencher(page, { motivo: 'Resultado de exames' });
    await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
    await expect(page.getByText('Autorize o registro do motivo, ou deixe o campo em branco.')).toBeVisible();
  });

  test('voltar e avançar preserva o que foi preenchido', async ({ page }) => {
    await irParaHorarios(page);
    await escolherHorario(page);
    await page.getByRole('button', { name: /Continuar/ }).click();
    await page.getByRole('textbox', { name: /Nome completo/ }).fill('Bruno Lima');

    await page.getByRole('button', { name: 'Voltar' }).click();
    await expect(page.getByRole('radiogroup', { name: 'Dia da consulta' })).toBeVisible();
    await page.getByRole('button', { name: /Continuar/ }).click();
    await expect(page.getByRole('textbox', { name: /Nome completo/ })).toHaveValue('Bruno Lima');
  });

  test('outra pessoa leva o horário no meio do caminho: volta à etapa 2 COM os dados', async ({ page, request }) => {
    await irParaHorarios(page);
    const slot = page.locator('[aria-labelledby="rotulo-horarios"] [role="radio"]').first();
    await slot.click();
    await page.getByRole('button', { name: /Continuar/ }).click();
    await preencher(page, { nome: 'Carla Dias' });

    // enquanto ela preenche, alguém agenda o mesmo horário pela API
    const escolhido = await slotLivre(request);
    await agendarPelaApi(request, escolhido);

    await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'acabou de ser reservado' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Dia da consulta' })).toBeVisible();

    await escolherHorario(page);
    await page.getByRole('button', { name: /Continuar/ }).click();
    await expect(page.getByRole('textbox', { name: /Nome completo/ })).toHaveValue('Carla Dias');
  });

  test('cancelamento em duas etapas, e o .ics passa a remover o evento', async ({ page, request }) => {
    const r = await agendarPelaApi(request, await slotLivre(request, 48));
    await page.goto(r.urlGestao);

    await page.getByRole('button', { name: 'Cancelar consulta' }).click();
    const sim = page.getByRole('button', { name: 'Sim, cancelar' });
    await expect(sim).toBeFocused();
    await expect(page.getByRole('button', { name: 'Manter consulta' })).toBeVisible();
    await sim.click();

    await expect(page.getByRole('heading', { name: 'Consulta cancelada', level: 1 })).toBeVisible();
    const ics = await (await request.get(r.urlIcs)).text();
    expect(ics).toContain('METHOD:CANCEL');
    expect(ics).toContain('SEQUENCE:1');
  });

  test('link de gestão inválido dá 404', async ({ page }) => {
    const r = await page.goto(`/consulta/${'A'.repeat(43)}`);
    expect(r?.status()).toBe(404);
  });

  test('página de gestão não vaza o token pelo Referer', async ({ page, request }) => {
    const r = await agendarPelaApi(request, await slotLivre(request, 48));
    await page.goto(r.urlGestao);
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
  });
});

test.describe('teleconsulta de outro fuso (Manaus, UTC−4)', () => {
  test.use({ viewport: { width: 375, height: 667 }, timezoneId: 'America/Manaus' });

  test('mostra o horário de Brasília e, entre parênteses, o do paciente', async ({ page }) => {
    await irParaHorarios(page, /Teleconsulta/);
    await expect(page.getByText(/Horários de Brasília · entre parênteses, no seu fuso \(Manaus\)/)).toBeVisible();
    const slot = page.locator('[aria-labelledby="rotulo-horarios"] [role="radio"]').first();
    const [brasilia, local] = (await slot.innerText()).split('\n').map((t) => t.replace(/[()]/g, '').trim());
    const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
    expect(minutos(brasilia!) - minutos(local!)).toBe(60);
  });

  test('presencial não mostra fuso do paciente (a consulta é no consultório)', async ({ page }) => {
    await irParaHorarios(page);
    await expect(page.getByText(/no seu fuso/)).toHaveCount(0);
  });
});

test.describe('teclado (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('fluxo completo sem mouse', async ({ page }) => {
    await page.goto('/agendar');
    const modalidade = page.getByRole('radio', { name: /Consulta presencial/ });
    await modalidade.focus();
    await page.keyboard.press('Space');
    await expect(modalidade).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: /Continuar/ }).focus();
    await page.keyboard.press('Enter');

    // título da etapa recebe o foco
    await expect(page.getByRole('heading', { name: 'Escolha o dia e o horário' })).toBeFocused();

    // setas percorrem os horários
    const slots = page.locator('[aria-labelledby="rotulo-horarios"] [role="radio"]');
    await slots.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(slots.nth(1)).toBeFocused();
    await expect(slots.nth(1)).toHaveAttribute('aria-checked', 'true');

    await page.getByRole('button', { name: /Continuar/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Para quem é a consulta?' })).toBeFocused();

    // Cada Tab AFIRMA onde o foco está: ordem de foco = ordem visual (WCAG 2.4.3).
    const tab = async (alvo: ReturnType<Page['getByRole']>) => {
      await page.keyboard.press('Tab');
      await expect(alvo).toBeFocused();
    };
    await tab(page.getByRole('button', { name: 'Alterar' }));
    await tab(page.getByRole('textbox', { name: /Nome completo/ }));
    await page.keyboard.type('Diego Costa');
    await tab(page.getByRole('textbox', { name: /Celular/ }));
    await page.keyboard.type('11987651234');
    await expect(page.getByRole('textbox', { name: /Celular/ })).toHaveValue('(11) 98765-1234');
    await tab(page.getByRole('textbox', { name: 'E-mail', exact: true }));
    await page.keyboard.type(email());
    await tab(page.getByRole('textbox', { name: /Motivo/ }));
    await tab(page.getByRole('checkbox', { name: /Autorizo o uso do meu nome/ }));
    await page.keyboard.press('Space');
    await expect(page.getByRole('checkbox', { name: /Autorizo o uso do meu nome/ })).toBeChecked();
    await tab(page.getByRole('link', { name: 'política de privacidade', exact: true }));
    await tab(page.getByRole('button', { name: 'Voltar' }));
    await tab(page.getByRole('button', { name: 'Confirmar agendamento' }));
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: /Consulta confirmada, Diego/ })).toBeFocused();
  });
});

test.describe('acessibilidade de cada etapa (axe)', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true });

  test('etapas 1, 2, 3 e confirmação sem violações WCAG 2.2 AA', async ({ page }) => {
    const verificar = async (etapa: string) => {
      // Mede a tela ASSENTADA: durante a entrada da etapa (280ms, opacidade
      // 0→1) o texto está semitransparente e o contraste reprova à toa.
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(r.violations.map((v) => `${etapa} · ${v.id}: ${v.help}`)).toEqual([]);
    };
    await page.goto('/agendar');
    await verificar('etapa 1');
    await page.getByRole('radio', { name: /Consulta presencial/ }).click();
    await page.getByRole('button', { name: /Continuar/ }).click();
    await expect(page.getByRole('radiogroup', { name: 'Dia da consulta' })).toBeVisible();
    await verificar('etapa 2');
    await escolherHorario(page);
    await page.getByRole('button', { name: /Continuar/ }).click();
    await page.getByRole('button', { name: 'Confirmar agendamento' }).click();   // com erros visíveis
    await verificar('etapa 3 com erros');
    await preencher(page);
    await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
    await expect(page.getByRole('heading', { name: /Consulta confirmada/ })).toBeVisible();
    await verificar('confirmação');
  });
});
