// Apply drizzle/*.sql files that this database has not recorded yet.
//
//   bun scripts/migrate.ts                     # DATABASE_URL (local development)
//   bun scripts/migrate.ts staging             # STAGING_DATABASE_URL_FROM_HOST
//   bun scripts/migrate.ts live                # LIVE_DATABASE_URL_FROM_HOST
//   bun scripts/migrate.ts live --baseline     # record every file as applied WITHOUT running it
//
// Each file runs in its own transaction together with its schema_migrations row, so a failure
// leaves nothing half-applied and the next run retries it. Bun loads .env automatically.
// deploy.ps1 runs this before recreating a container and stops if it exits non-zero.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { CONTAINER_URL_VAR, HOST_URL_VAR, checkTarget, databaseName, isTarget } from "../src/lib/dbtarget";
import { migrationFiles, pendingMigrations, stripOwnTransaction, summarize, unknownApplied } from "../src/lib/migrations";

const DIR = path.join(import.meta.dirname, "..", "drizzle");

async function main() {
  const args = process.argv.slice(2);
  const baseline = args.includes("--baseline");
  const target = args.find((a) => !a.startsWith("--"));
  if (target !== undefined && !isTarget(target)) throw new Error(`unknown target "${target}" (live | staging)`);

  let url: string | undefined;
  let name: string;
  if (target) {
    url = process.env[HOST_URL_VAR[target]];
    name = checkTarget(target, url, process.env[CONTAINER_URL_VAR[target]]);
  } else {
    url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set (or pass live | staging)");
    name = databaseName(url);
  }

  const files = migrationFiles(readdirSync(DIR));
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query<{ filename: string }>("SELECT filename FROM schema_migrations");
    const applied = rows.map((r) => r.filename);
    const pending = pendingMigrations(files, applied);
    for (const f of unknownApplied(files, applied)) console.warn(`migrations: warning: ${f} is recorded in ${name} but not in drizzle/`);

    if (baseline) {
      for (const f of pending) await client.query("INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING", [f]);
      console.log(pending.length ? `migrations: baselined ${name} (${pending.join(", ")}) without running them` : "migrations: up to date");
      return;
    }

    const done: string[] = [];
    for (const f of pending) {
      const sql = stripOwnTransaction(readFileSync(path.join(DIR, f), "utf8"));
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [f]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        if (done.length) summarize(done).forEach((line) => console.log(line));
        throw new Error(`${f} failed and was rolled back: ${(err as Error).message}`);
      }
      done.push(f);
    }
    for (const line of summarize(done)) console.log(line);
  } finally {
    await client.end();
  }
}

main().catch((err: Error) => {
  console.error(`migrations: FAILED: ${err.message}`);
  process.exit(1);
});
