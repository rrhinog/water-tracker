// Which drizzle/*.sql files still need applying. Pure; scripts/migrate.ts does the I/O.

/** A migration file: four digits, underscore, name, .sql (e.g. 0005_add_notes.sql). */
export const MIGRATION_FILE = /^\d{4}_[A-Za-z0-9_-]+\.sql$/;

/** Migration files in apply order (the numeric prefix sorts as text). Other files are ignored. */
export function migrationFiles(names: readonly string[]): string[] {
  return names.filter((n) => MIGRATION_FILE.test(n)).sort();
}

/** Files not yet recorded in schema_migrations, in order. */
export function pendingMigrations(files: readonly string[], applied: Iterable<string>): string[] {
  const done = new Set(applied);
  return migrationFiles(files).filter((f) => !done.has(f));
}

/** Recorded as applied but missing from drizzle/: a renamed or deleted file, or a database ahead of this branch. */
export function unknownApplied(files: readonly string[], applied: Iterable<string>): string[] {
  const known = new Set(migrationFiles(files));
  return [...applied].filter((a) => !known.has(a)).sort();
}

/**
 * The runner wraps every file in its own transaction together with the schema_migrations insert.
 * A file that already says BEGIN; / COMMIT; on their own lines (0004 does) would end that
 * transaction early, so those two lines are removed; everything else runs as written.
 */
export function stripOwnTransaction(sql: string): string {
  return sql
    .split(/\r?\n/)
    .filter((line) => !/^\s*(BEGIN|COMMIT)\s*;\s*$/i.test(line))
    .join("\n");
}

/** The runner's summary line(s). */
export function summarize(applied: readonly string[]): string[] {
  return applied.length ? applied.map((f) => `migrations: applied ${f}`) : ["migrations: up to date"];
}
