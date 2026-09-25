/**
 * Prepara o banco de TESTE para o E2E: migra pelo journal, semeia e limpa
 * agendamentos. Sem DATABASE_URL_TEST, os testes de agendamento se pulam.
 */
import { execFileSync } from 'node:child_process';
import postgres from 'postgres';
import { semear } from '../../scripts/seed';

export default async function globalSetup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) return;
  execFileSync('npx', ['tsx', 'scripts/migrate.ts'], {
    env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url }, stdio: 'pipe',
  });
  await semear(url);
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql`DELETE FROM notification`;
  await sql`DELETE FROM audit_log`;
  await sql`DELETE FROM appointment`;
  await sql.end();
}
