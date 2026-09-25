import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

/**
 * E2E contra o build de PRODUÇÃO (next start), não o dev server:
 * é o que o paciente recebe.
 *
 * Chromium pré-instalado no ambiente remoto em /opt/pw-browsers; localmente
 * cai no navegador padrão do Playwright.
 */
export const ENV_PAINEL_E2E = {
  AUTH_SECRET: 'segredo-e2e-de-sessao-com-mais-de-32-caracteres',
  ADMIN_EMAIL: 'admin-e2e@exemplo.com',
  GOOGLE_CLIENT_ID: 'e2e.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'segredo-e2e',
  GOOGLE_WEBHOOK_TOKEN: 'token-do-webhook-e2e-16+',
  ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
  CRON_SECRET: 'segredo-do-cron-e2e-16+',
};

const chromiumLocal = process.env.PLAYWRIGHT_CHROMIUM ?? '/opt/pw-browsers/chromium';
const bancoTeste = process.env.DATABASE_URL_TEST;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100',
    launchOptions: { executablePath: existsSync(chromiumLocal) ? chromiumLocal : undefined },
  },
  webServer: {
    command: 'npx next start -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      ...(bancoTeste ? { DATABASE_URL: bancoTeste } : {}),
      TOKEN_SALT: process.env.TOKEN_SALT ?? 'sal-de-teste-com-16-caracteres-ou-mais',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3100',
      // Teste é o caso consciente: sem agenda conectada, com regras fictícias.
      AGENDAMENTO_SEM_GOOGLE: 'aceito',
      // Painel: credenciais FALSAS — o login real passa pelo Google; o E2E
      // assina a sessão com o mesmo segredo (tests/e2e/admin.spec.ts).
      ...ENV_PAINEL_E2E,
    },
  },
});
