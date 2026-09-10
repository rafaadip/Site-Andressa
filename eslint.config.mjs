import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**', 'out/**', 'build/**', 'next-env.d.ts',
    'lib/db/migrations/**', 'skills/**', 'docs/**',
  ]),
  {
    rules: {
      /**
       * Regra inviolável nº 1 (docs/DOCUMENTACAO.md §6):
       * conversão de fuso SÓ em lib/datetime.ts.
       *
       * Os padrões abaixo são exatamente os do protótipo `index.html`,
       * que sairia uma hora deslocado — em silêncio — se o horário de
       * verão voltasse.
       */
      'no-restricted-syntax': ['error',
        {
          // `new Date(d.getTime() + 3 * 3600000)` — o bug exato do protótipo.
          selector: "NewExpression[callee.name='Date'] > BinaryExpression CallExpression[callee.property.name='getTime']",
          message: 'Aritmética de offset sobre getTime(). Use somarMinutos()/horaLocalParaUtc() de lib/datetime.ts.',
        },
        {
          selector: 'Literal[value=10800000]',
          message: '10800000ms = 3h fixas. O offset do Brasil não é constante por contrato. Use lib/datetime.ts.',
        },
        {
          selector: "CallExpression[callee.property.name='getTimezoneOffset']",
          message: 'getTimezoneOffset() devolve o fuso do SERVIDOR, não o da clínica. Use lib/datetime.ts.',
        },
      ],
    },
  },
  {
    // datetime.ts é a única exceção: é ele que encapsula a conversão.
    files: ['lib/datetime.ts', 'tests/**/*.ts', 'scripts/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
]);
