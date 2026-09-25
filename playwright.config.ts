import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

/**
 * E2E contra o build de PRODUÇÃO (next start), não o dev server:
 * é o que o paciente recebe.
 *
 * Chromium pré-instalado no ambiente remoto em /opt/pw-browsers; localmente
 * cai no navegador padrão do Playwright.
 */
const chromiumLocal = process.env.PLAYWRIGHT_CHROMIUM ?? '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
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
  },
});
