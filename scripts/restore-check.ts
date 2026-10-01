// Prove a backup restores: load it into a throwaway Postgres and count every table's rows.
//
//   bun scripts/restore-check.ts <file.dump>
//
// Runs `docker run --rm` with the image of PG_CONTAINER (or RESTORE_CHECK_IMAGE, or
// postgres:16-alpine): the dump goes in on stdin, a fresh server restores it, the counts come out,
// and the container is removed when it finishes. Your real database server is never touched.
// With the .json that scripts/backup.ts writes beside a dump, the counts must match it exactly
// (exit 1 otherwise); for an older dump without one, it only reports them.
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { RESTORE_CHECK_SCRIPT, compareCounts, parseCounts, type Counts } from "../src/lib/backup";
import { run } from "./proc";

const TIMEOUT_MS = 180_000;

async function image(): Promise<string> {
  if (process.env.RESTORE_CHECK_IMAGE) return process.env.RESTORE_CHECK_IMAGE;
  const container = process.env.PG_CONTAINER;
  if (!container) return "postgres:16-alpine";
  const p = await run(["docker", "inspect", "--format", "{{.Config.Image}}", container]);
  if (p.code !== 0 || !p.stdout.trim()) throw new Error(`can't read the image of container "${container}"`);
  return p.stdout.trim();
}

async function main() {
  const file = process.argv[2];
  if (!file || !existsSync(file)) throw new Error("usage: bun scripts/restore-check.ts <file.dump>");
  const sidecar = `${file}.json`;
  const expected: Counts | undefined = existsSync(sidecar) ? JSON.parse(readFileSync(sidecar, "utf8")).tables : undefined;

  const img = await image();
  const name = `water-tracker-restore-check-${randomUUID().slice(0, 8)}`;
  const password = randomUUID();
  console.log(`restore-check: ${file} -> throwaway ${img} (${name})`);
  const timer = setTimeout(() => {
    console.error(`restore-check: no result after ${TIMEOUT_MS / 1000}s; stopping ${name}`);
    void run(["docker", "stop", name]);
  }, TIMEOUT_MS);
  const result = await run(
    ["docker", "run", "--rm", "-i", "--name", name, "-e", "POSTGRES_PASSWORD", "-e", "PGPASSWORD", "-e", "POSTGRES_DB=restore_check", img, "sh", "-c", RESTORE_CHECK_SCRIPT],
    { stdinFile: file, env: { ...process.env, POSTGRES_PASSWORD: password, PGPASSWORD: password } },
  );
  clearTimeout(timer);
  if (result.code !== 0) throw new Error(`the restore failed (exit ${result.code}): ${result.stderr.trim().slice(-800)}`);

  const restored = parseCounts(result.stdout);
  if (!expected) {
    console.log(Object.entries(restored).map(([t, n]) => `     ${t}: restored ${n}`).join("\n"));
    console.log(`restore-check: restored ${Object.keys(restored).length} tables (no .json beside this dump to compare with)`);
    if (!Object.keys(restored).length) process.exit(1);
    return;
  }
  const { ok, lines } = compareCounts(expected, restored);
  console.log(lines.map((l) => `  ${l}`).join("\n"));
  console.log(ok ? "restore-check: PASS — every table restored with the same row count" : "restore-check: FAIL");
  if (!ok) process.exit(1);
}

main().catch((err: Error) => {
  console.error(`restore-check: FAILED: ${err.message}`);
  process.exit(1);
});
