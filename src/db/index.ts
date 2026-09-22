import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/** Lazily-created connection pool; throws only when a request actually needs the database. */
export function getDb() {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  db = drizzle(new Pool({ connectionString: url, max: 5 }), { schema });
  return db;
}

export * from "./schema";
