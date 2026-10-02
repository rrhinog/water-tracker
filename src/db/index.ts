import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Pool settings. Each timeout is a ceiling, not a target:
 * - connectionTimeoutMillis: a request waiting on a database that is down fails after 5 s instead of
 *   hanging forever (the pg default is no limit). pg also applies it to a request that waits for a free
 *   client when all of them are busy, which is harmless for a one-user app. It sits above /api/health's 3 s
 *   deadline, so a health probe still reports "down" first, and is well above a normal connect on the same host.
 * - idleTimeoutMillis: an idle connection is closed after 10 s. That is pg-pool's own default, pinned here so
 *   the value is visible and a library upgrade cannot change it silently.
 * No statement timeout: a server-side limit that is set too low fails real writes, and the app's queries are
 * short, so a bounded connect plus the 3 s health deadline is enough for now.
 */
export const POOL_OPTIONS = { max: 5, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 10_000 } as const;

/**
 * An idle client that errors (a database restart, a dropped connection) is re-emitted by the pool as an
 * "error" event. With no listener Node treats it as uncaught and the process exits. The pool discards
 * the broken client itself and opens a new one on the next request, so logging is all that is needed.
 * The message is logged; the connection string never is.
 */
export function createPool(url: string): Pool {
  const pool = new Pool({ connectionString: url, ...POOL_OPTIONS });
  pool.on("error", (err) => {
    console.error(`[db] idle connection error (pool keeps serving): ${err.message}`);
  });
  return pool;
}

/** Lazily-created connection pool; throws only when a request actually needs the database. */
export function getDb() {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  db = drizzle(createPool(url), { schema });
  return db;
}

export * from "./schema";
