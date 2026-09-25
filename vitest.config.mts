import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      // Fora do Next, `server-only` lançaria ao ser importado.
      'server-only': fileURLToPath(new URL('./tests/setup/vazio.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // .tsx = componentes (cada arquivo declara `@vitest-environment jsdom`).
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globalSetup: ['tests/setup/banco.ts'],
    // Integração compartilha UM banco: arquivos em série evitam que um
    // DELETE de um teste apague as linhas de outro.
    fileParallelism: false,
    env: {
      TOKEN_SALT: 'sal-de-teste-com-16-caracteres-ou-mais',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3100',
      ...(process.env.DATABASE_URL_TEST ? { DATABASE_URL: process.env.DATABASE_URL_TEST } : {}),
    },
    coverage: {
      include: ['lib/**/*.ts'],
      thresholds: {
        lines: 85, functions: 80,
        // FASE-12 §8: o núcleo (motor e calendário) com ≥ 90 %.
        'lib/availability/**': { statements: 90, lines: 90 },
        'lib/calendar/**': { statements: 90, lines: 90 },
      },
    },
  },
});
