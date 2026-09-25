/**
 * Cliente do banco — um por processo.
 *
 * `prepare: false`: o pooler do Supabase (porta 6543) roda em modo
 * transação, que não suporta prepared statements.
 * `max` baixo: em serverless cada instância abre o próprio pool.
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { envBanco } from '../env';
import { tlsDoBanco } from './tls';
import * as schema from './schema';

type Db = ReturnType<typeof drizzle<typeof schema>>;

const global_ = globalThis as unknown as { __db?: Db; __sql?: postgres.Sql };

export function sqlCliente(): postgres.Sql {
  const url = envBanco().DATABASE_URL;
  const ssl = tlsDoBanco(url);
  global_.__sql ??= postgres(url, {
    // Só com valor: `ssl: undefined` desligaria o `sslmode` da URL.
    ...(ssl ? { ssl } : {}),
    max: 5,
    prepare: false,
    idle_timeout: 20,
    // Banco inacessível não pode pendurar a função por 30 s (padrão). O
    // pooler do Supabase conecta em ~100–300 ms; 5 s é folga larga.
    connect_timeout: 5,
    onnotice: () => {},
  });
  return global_.__sql;
}

export function db(): Db {
  global_.__db ??= drizzle(sqlCliente(), { schema });
  return global_.__db;
}

export { schema };
