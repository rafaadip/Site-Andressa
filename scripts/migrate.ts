/**
 * Aplica as migrations pelo JOURNAL do Drizzle (lib/db/migrations/meta).
 *
 * ⚠️ Nunca aplicar .sql à mão com psql em produção: o migrator só conhece o
 * que está no journal, e registra o que já rodou em drizzle.__drizzle_migrations.
 * Foi assim que a trava anti-overbooking (0001) quase ficou de fora do deploy.
 *
 * Depois de migrar, CONFERE que a constraint existe — e falha se não existir.
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error('Defina DATABASE_URL (ou DATABASE_URL_UNPOOLED).');

  const cliente = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(cliente), { migrationsFolder: 'lib/db/migrations' });

  const r = await cliente`
    SELECT 1 FROM pg_constraint WHERE conname = 'appointment_no_overlap'`;
  await cliente.end();

  if (r.length !== 1) {
    console.error('\n  ✗ Constraint appointment_no_overlap AUSENTE. Overbooking possível.\n');
    process.exit(1);
  }
  console.log('\n  ✓ Migrations aplicadas · trava anti-overbooking presente.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
