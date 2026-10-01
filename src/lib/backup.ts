// Backups: file names, how pg_dump is run, and the restore check's script and verdict.
// Pure: scripts/backup.ts and scripts/restore-check.ts do the I/O.

export type PgConnection = { host: string; port: string; user: string; password: string; database: string };
export type Counts = Record<string, number>;

/** The pieces pg_dump needs from a postgres:// URL. The password travels in PGPASSWORD, never on a command line. */
export function pgConnection(url: string): PgConnection {
  const u = new URL(url);
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") throw new Error("not a postgres:// URL");
  const database = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (!database) throw new Error("the URL names no database");
  return {
    host: u.hostname || "127.0.0.1",
    port: u.port || "5432",
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database,
  };
}

/** water_tracker_pre_v1.9.0_2026-10-17_0912.dump: sorts by name, safe on any file system. */
export function backupFileName(database: string, label: string, at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}_${pad(at.getHours())}${pad(at.getMinutes())}`;
  const safe = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "-");
  return `${safe(database)}_pre_${safe(label)}_${stamp}.dump`;
}

/**
 * The pg_dump command for one database, in custom format (what pg_restore reads), at a snapshot
 * the caller exported so the dump and the caller's row counts see the same moment. With a
 * container, pg_dump runs inside it and connects to that container's own server on 5432, so
 * this machine needs no Postgres tools of its own.
 */
export function dumpCommand(c: PgConnection, snapshot: string, container?: string): string[] {
  const args = ["--format=custom", `--snapshot=${snapshot}`, "--no-password", "-U", c.user, "-d", c.database];
  return container
    ? ["docker", "exec", "-i", "-e", "PGPASSWORD", container, "pg_dump", "-h", "127.0.0.1", "-p", "5432", ...args]
    : ["pg_dump", "-h", c.host, "-p", c.port, ...args];
}

/**
 * pg_restore that replaces the database's contents with a dump, in one transaction: if anything
 * fails, nothing changed. With a container the dump goes in on stdin; otherwise it is the last argument.
 */
export function restoreCommand(c: PgConnection, container?: string, file?: string): string[] {
  const args = ["--clean", "--if-exists", "--no-owner", "--no-acl", "--single-transaction", "--exit-on-error", "--no-password", "-U", c.user, "-d", c.database];
  if (container) return ["docker", "exec", "-i", "-e", "PGPASSWORD", container, "pg_restore", "-h", "127.0.0.1", "-p", "5432", ...args];
  if (!file) throw new Error("restoreCommand: a file is needed without a container");
  return ["pg_restore", "-h", c.host, "-p", c.port, ...args, file];
}

/** The database a dump was taken from, from pg_restore --list's header ("" when it doesn't say). */
export function dumpDatabase(listing: string): string {
  return /^;\s+dbname:\s*(\S+)\s*$/im.exec(listing)?.[1] ?? "";
}

/**
 * Why a restore must not go ahead, or null. Checked before anything is touched: the caller typed
 * the database's name, the dump is of that same database (never staging's demo data into live, or
 * live's real data into staging), and the app is stopped so nothing writes during the restore.
 */
export function restoreRefusal(o: { database: string; confirm?: string; fromDatabase: string; container: string; containerRunning: boolean }): string | null {
  if (o.confirm !== `--yes-replace-${o.database}`) return `this replaces everything in ${o.database}; to go ahead, add --yes-replace-${o.database}`;
  if (!o.fromDatabase) return "the dump doesn't say which database it came from";
  if (o.fromDatabase !== o.database) return `the dump is of ${o.fromDatabase}, not ${o.database}`;
  if (o.containerRunning) return `${o.container} is running; stop it first so nothing writes during the restore (docker stop ${o.container})`;
  return null;
}

/** pg_restore --list prints one "TABLE DATA" line per table whose rows are in the file. */
export function tablesInDump(listing: string): string[] {
  return listing
    .split(/\r?\n/)
    .map((l) => /\bTABLE DATA \S+ (\S+) /.exec(l)?.[1])
    .filter((t): t is string => !!t)
    .sort();
}

/**
 * Runs inside a throwaway Postgres container started with `docker run --rm -i`: reads the dump
 * from stdin, starts a fresh server, restores into it, prints "table count" lines, then exits,
 * which removes the container. Waits on TCP because the image's first-run setup serves only a
 * socket and restarts before it is ready.
 */
export const RESTORE_CHECK_SCRIPT = [
  "set -e",
  "cat > /tmp/backup.dump",
  "docker-entrypoint.sh postgres > /tmp/postgres.log 2>&1 &",
  "n=0; until pg_isready -q -h 127.0.0.1 -U postgres; do n=$((n+1)); [ $n -gt 90 ] && { cat /tmp/postgres.log; exit 3; }; sleep 1; done",
  "pg_restore --no-owner --no-acl --exit-on-error -h 127.0.0.1 -U postgres -d restore_check /tmp/backup.dump",
  "psql -h 127.0.0.1 -U postgres -d restore_check -At -F ' ' -c \"select table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I', table_name), false, true, '')))[1]::text from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1\"",
].join("\n");

/** "table count" lines (from psql -At -F ' ') into counts; anything else is ignored. */
export function parseCounts(output: string): Counts {
  const counts: Counts = {};
  for (const line of output.split(/\r?\n/)) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*) (\d+)$/.exec(line.trim());
    if (m) counts[m[1]] = Number(m[2]);
  }
  return counts;
}

/** Same tables with the same row counts. One line per table for the report, and the verdict. */
export function compareCounts(expected: Counts, restored: Counts): { ok: boolean; lines: string[] } {
  const names = [...new Set([...Object.keys(expected), ...Object.keys(restored)])].sort();
  const lines = names.map((t) => {
    const want = expected[t];
    const got = restored[t];
    const mark = want === got ? "ok  " : "DIFF";
    return `${mark} ${t}: backed up ${want ?? "-"}, restored ${got ?? "-"}`;
  });
  return { ok: names.length > 0 && names.every((t) => expected[t] === restored[t]), lines };
}
