// Back up one target's database before a deploy changes it.
//
//   bun scripts/backup.ts live v1.9.0          # deploy.ps1 runs this before it migrates live
//   bun scripts/backup.ts staging rehearsal    # try it on staging
//
// Writes BACKUP_DIR/<db>_pre_<label>_<date>.dump (pg_dump's custom format, which pg_restore reads)
// and a .json beside it with every table's row count. Both come from one database snapshot, so
// the counts describe exactly what is in the file. The file must list every table before this
// says done. With PG_CONTAINER set, pg_dump runs inside that Postgres container; otherwise this
// machine's pg_dump is used. Exits non-zero on any failure, so deploy.ps1 stops before migrating.
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { backupFileName, dumpCommand, pgConnection, tablesInDump, type Counts } from "../src/lib/backup";
import { CONTAINER_URL_VAR, HOST_URL_VAR, checkTarget, isTarget } from "../src/lib/dbtarget";
import { run } from "./proc";

async function main() {
  const [target, label] = process.argv.slice(2);
  if (!isTarget(target) || !label) throw new Error("usage: bun scripts/backup.ts live|staging <label, e.g. v1.9.0>");
  const url = process.env[HOST_URL_VAR[target]];
  const database = checkTarget(target, url, process.env[CONTAINER_URL_VAR[target]]);
  const dir = process.env.BACKUP_DIR;
  if (!dir) throw new Error("BACKUP_DIR is not set (see .env.example): where backups are written");
  const container = process.env.PG_CONTAINER || undefined;
  const conn = pgConnection(url!);

  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, backupFileName(database, label, new Date()));

  const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
  await client.connect();
  const counts: Counts = {};
  try {
    // Hold one snapshot open: the counts below and pg_dump (--snapshot) both read it.
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY");
    const snapshot = (await client.query<{ s: string }>("SELECT pg_export_snapshot() AS s")).rows[0].s;
    const tables = (await client.query<{ t: string }>("SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public' ORDER BY 1")).rows.map((r) => r.t);
    for (const t of tables) counts[t] = (await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM "${t.replace(/"/g, '""')}"`)).rows[0].n;

    const dump = await run(dumpCommand(conn, snapshot, container), { stdoutFile: file, env: { ...process.env, PGPASSWORD: conn.password } });
    if (dump.code !== 0) throw new Error(`pg_dump failed: ${dump.stderr.trim().slice(0, 500)}`);
  } finally {
    await client.query("COMMIT").catch(() => {});
    await client.end();
  }

  // The file must open and hold every table's rows.
  const list = container
    ? await run(["docker", "exec", "-i", container, "pg_restore", "--list"], { stdinFile: file })
    : await run(["pg_restore", "--list", file]);
  if (list.code !== 0) throw new Error(`${file} does not open with pg_restore: ${list.stderr.trim().slice(0, 300)}`);
  const inFile = tablesInDump(list.stdout);
  const missing = Object.keys(counts).filter((t) => !inFile.includes(t));
  if (missing.length) throw new Error(`${file} is missing table data for ${missing.join(", ")}`);

  writeFileSync(`${file}.json`, JSON.stringify({ database, label, at: new Date().toISOString(), tables: counts }, null, 2) + "\n");
  const kb = Math.round(statSync(file).size / 1024);
  console.log(`backup: ${file} (${kb} KB) — ${Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(", ")}`);
}

main().catch((err: Error) => {
  console.error(`backup: FAILED: ${err.message}`);
  process.exit(1);
});
