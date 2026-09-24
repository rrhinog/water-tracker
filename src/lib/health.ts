// /api/health: version string and a DB round-trip with a deadline. Pure; the route passes the ping in.

/** "1.6.0+abc1234", or just "1.6.0" when the build had no git sha (local dev, CI). */
export function appVersion(pkgVersion: string, gitSha: string | undefined): string {
  const sha = gitSha?.trim();
  return sha && /^[0-9a-f]{4,40}$/i.test(sha) ? `${pkgVersion}+${sha.slice(0, 12)}` : pkgVersion;
}

export interface Health {
  ok: boolean;
  version: string;
  db: boolean;
}

/** Runs the ping with a deadline; a failure or timeout means the database is down. */
export async function checkHealth(ping: () => Promise<unknown>, version: string, timeoutMs = 3000): Promise<{ status: 200 | 503; body: Health }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer in ${timeoutMs} ms`)), timeoutMs);
  });
  try {
    await Promise.race([ping(), deadline]);
    return { status: 200, body: { ok: true, version, db: true } };
  } catch (err) {
    console.error(`[health] database check failed: ${(err as Error).message}`);
    return { status: 503, body: { ok: false, version, db: false } };
  } finally {
    clearTimeout(timer);
  }
}
