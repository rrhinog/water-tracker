// Last resort: replace a database's contents with a backup. Rolling the app back
// (deploy.ps1 live <older tag>) comes first; this is for data that is wrong or lost. RUNBOOK.md
// has the whole procedure.
//
//   docker stop water-tracker-staging
//   bun scripts/restore.ts staging <file.dump> --yes-replace-water_tracker_staging
//   .\scripts\deploy.ps1 staging v1.9.0      # migrates the restored database to that version, starts it
//
// Refuses unless the database's name is typed out, the dump is of that same database, and the
// app's container is stopped. Then it backs the database up as it is now (label "restore"), so the
// restore itself can be undone, and restores in one transaction: all or nothing. Prints each table's
// rows, compared with the dump's .json when there is one.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { compareCounts, dumpDatabase, pgConnection, restoreCommand, restoreRefusal, type Counts } from "../src/lib/backup";
import { CONTAINER_URL_VAR, HOST_URL_VAR, checkTarget, isTarget, type Target } from "../src/lib/dbtarget";
import { run } from "./proc";

const APP_CONTAINER: Record<Target, string> = { live: "water-tracker", staging: "water-tracker-staging" };

async function main() {
  const [target, file, confirm] = process.argv.slice(2);
  if (!isTarget(target) || !file) throw new Error("usage: bun scripts/restore.ts live|staging <file.dump> --yes-replace-<database>");
  if (!existsSync(file)) throw new Error(`no such file: ${file}`);
  const url = process.env[HOST_URL_VAR[target]];
  const database = checkTarget(target, url, process.env[CONTAINER_URL_VAR[target]]);
  const conn = pgConnection(url!);
  const pg = process.env.PG_CONTAINER || undefined;
  const container = APP_CONTAINER[target];

  // Guards first; nothing is touched until all of them hold.
  const list = pg ? await run(["docker", "exec", "-i", pg, "pg_restore", "--list"], { stdinFile: file }) : await run(["pg_restore", "--list", file]);
  if (list.code !== 0) throw new Error(`${file} does not open with pg_restore: ${list.stderr.trim().slice(0, 300)}`);
  const ps = await run(["docker", "ps", "--filter", `name=^/${container}$`, "--format", "{{.Names}}"]);
  if (ps.code !== 0) throw new Error("can't ask Docker whether the app is running");
  const refusal = restoreRefusal({ database, confirm, fromDatabase: dumpDatabase(list.stdout), container, containerRunning: ps.stdout.trim() !== "" });
  if (refusal) throw new Error(refusal);

  console.log(`restore: first, a backup of ${database} as it is now`);
  const safety = await run([process.execPath, path.join(import.meta.dirname, "backup.ts"), target, "restore"]);
  process.stdout.write(safety.stdout);
  if (safety.code !== 0) throw new Error(`that backup failed, so nothing was restored: ${safety.stderr.trim()}`);

  console.log(`restore: replacing ${database} with ${path.basename(file)} (one transaction: all or nothing)`);
  const r = await run(restoreCommand(conn, pg, file), { stdinFile: pg ? file : undefined, env: { ...process.env, PGPASSWORD: conn.password } });
  if (r.code !== 0) throw new Error(`pg_restore failed, so ${database} is unchanged: ${r.stderr.trim().slice(-600)}`);

  const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
  await client.connect();
  const counts: Counts = {};
  try {
    const tables = (await client.query<{ t: string }>("SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public' ORDER BY 1")).rows.map((x) => x.t);
    for (const t of tables) counts[t] = (await client.query<{ n: number }>(`SELECT count(*)::int AS n FROM "${t.replace(/"/g, '""')}"`)).rows[0].n;
  } finally {
    await client.end();
  }
  const sidecar = `${file}.json`;
  if (existsSync(sidecar)) {
    const { ok, lines } = compareCounts(JSON.parse(readFileSync(sidecar, "utf8")).tables, counts);
    console.log(lines.map((l) => `  ${l}`).join("\n"));
    if (!ok) throw new Error("the restored rows don't match the backup's record");
  } else {
    console.log(Object.entries(counts).map(([t, n]) => `  ${t}: ${n}`).join("\n"));
  }
  console.log(`restore: done. ${container} is still stopped. Next: .\\scripts\\deploy.ps1 ${target} <version> (migrates to that version and starts it)`);
}

main().catch((err: Error) => {
  console.error(`restore: REFUSED or FAILED: ${err.message}`);
  process.exit(1);
});
