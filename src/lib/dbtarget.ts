// Which database a host-side script (migrate, seed) is about to touch, and whether it may.
// Pure: the scripts read the environment and hand the URLs in.

export type Target = "live" | "staging";

/**
 * Host-side URL variable per target. Scripts run on the host, where Postgres is 127.0.0.1;
 * the containers use LIVE_DATABASE_URL / STAGING_DATABASE_URL, where it is "postgres".
 */
export const HOST_URL_VAR: Record<Target, string> = {
  live: "LIVE_DATABASE_URL_FROM_HOST",
  staging: "STAGING_DATABASE_URL_FROM_HOST",
};
export const CONTAINER_URL_VAR: Record<Target, string> = {
  live: "LIVE_DATABASE_URL",
  staging: "STAGING_DATABASE_URL",
};

export function isTarget(s: string | undefined): s is Target {
  return s === "live" || s === "staging";
}

/** The database name in a postgres:// URL ("" when it has none). Throws on a malformed URL. */
export function databaseName(url: string): string {
  const u = new URL(url);
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") throw new Error("not a postgres:// URL");
  return decodeURIComponent(u.pathname.replace(/^\//, ""));
}

/** A database that may be wiped and refilled: its name ends in _staging or _demo. */
export function isDisposableDatabase(name: string): boolean {
  return /^[A-Za-z0-9_]+_(staging|demo)$/.test(name);
}

/** The seed script's hard guard. Returns the database name, or throws before any connection is made. */
export function assertSeedTarget(url: string | undefined): string {
  if (!url) throw new Error("no database URL given");
  const name = databaseName(url);
  if (!isDisposableDatabase(name)) {
    throw new Error(`refusing to seed "${name || "(no database)"}": demo data only goes into a database whose name ends in _staging or _demo`);
  }
  return name;
}

/**
 * Checks before migrating a deploy target. Staging must be a disposable database and live must not
 * be; when the container's URL is known, both variables must name the same database, so the
 * migrated database is the one the container will use.
 */
export function checkTarget(target: Target, hostUrl: string | undefined, containerUrl?: string): string {
  if (!hostUrl) throw new Error(`${HOST_URL_VAR[target]} is not set (see .env.example)`);
  const name = databaseName(hostUrl);
  if (!name) throw new Error(`${HOST_URL_VAR[target]} has no database name`);
  if (target === "staging" && !isDisposableDatabase(name)) throw new Error(`staging must use its own database (…_staging), not "${name}"`);
  if (target === "live" && isDisposableDatabase(name)) throw new Error(`live points at "${name}", which looks like a staging/demo database`);
  if (containerUrl) {
    const other = databaseName(containerUrl);
    if (other !== name) throw new Error(`${HOST_URL_VAR[target]} ("${name}") and ${CONTAINER_URL_VAR[target]} ("${other}") name different databases`);
  }
  return name;
}
