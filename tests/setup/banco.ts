/**
 * Global setup dos testes de integração: migra (pelo journal, como em
 * produção) e semeia o banco de TESTE. Sem DATABASE_URL_TEST, não faz nada
 * e os testes de integração se pulam sozinhos.
 */
import { execFileSync } from 'node:child_process';
import { semear } from '../../scripts/seed';

export default async function setup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) return;
  execFileSync('npx', ['tsx', 'scripts/migrate.ts'], {
    env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
    stdio: 'pipe',
  });
  await semear(url);
}
