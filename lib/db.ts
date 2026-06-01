import { Pool, QueryResult, QueryResultRow } from "pg";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/db must only be imported on the server. " +
    "Do not import it from any 'use client' file."
  );
}

declare global {
  var __pgPool: Pool | undefined;
}

function createPool(): Pool {
  return new Pool({
    host: process.env.PGHOST ?? "127.0.0.1",
    port: parseInt(process.env.PGPORT ?? "5432", 10),
    database: process.env.PGDATABASE ?? "scorecard",
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

const pool: Pool = global.__pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  global.__pgPool = pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export { pool };
export type { QueryResult, QueryResultRow };
