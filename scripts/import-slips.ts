// One-time import of slips kept by hand in a markdown file (format: src/lib/importSlips.ts).
//
//   bun scripts/import-slips.ts <file.md> staging            # dry run: counts only, writes nothing
//   bun scripts/import-slips.ts <file.md> live --apply       # write them
//
// The file is passed by path and never copied into the repo. Vices are matched against the target's
// saved Settings, so add them in Settings first. Refuses to write while any dated line can't be
// placed. Idempotent: ids come from the date, vice and order, and an existing id is left alone.
// Prints counts and a date range, never a slip's details. Run with the host's time zone set to the
// one the slips were written in: a slip with no time lands at noon local time.
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { CONTAINER_URL_VAR, HOST_URL_VAR, checkTarget, isTarget } from "../src/lib/dbtarget";
import { importSummary, parseSlipFile } from "../src/lib/importSlips";
import { normalizeSettings } from "../src/lib/settings";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const [file, target] = args.filter((a) => !a.startsWith("--"));
  if (!file || !isTarget(target)) throw new Error("usage: bun scripts/import-slips.ts <file.md> <live|staging> [--apply]");
  const url = process.env[HOST_URL_VAR[target]];
  const name = checkTarget(target, url, process.env[CONTAINER_URL_VAR[target]]);
  const text = readFileSync(file, "utf8");

  const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    const { rows } = await client.query<{ value: unknown }>("SELECT value FROM settings WHERE key = 'app'");
    const { vices } = normalizeSettings(rows[0]?.value);
    if (vices.length === 0) throw new Error(`${name} has no vices in Settings; add them first`);
    const result = parseSlipFile(text, vices);
    console.log(`import: ${name}: ${importSummary(result)}; skipped ${result.skipped.length} (clean or coffee)`);
    for (const e of result.errors) console.log(`import: line ${e.line}: ${e.reason}`);
    if (result.errors.length) throw new Error(`${result.errors.length} line(s) can't be placed; fix the file and run again`);
    if (!apply) {
      console.log("import: dry run, nothing written (add --apply to write)");
      return;
    }
    await client.query("BEGIN");
    let added = 0;
    for (const s of result.slips) {
      const r = await client.query(
        "INSERT INTO slips (id, vice, at, kind, from_notes) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
        [s.id, s.vice, s.at, s.kind ?? null, s.fromNotes ?? false],
      );
      added += r.rowCount ?? 0;
    }
    await client.query("COMMIT");
    console.log(`import: wrote ${added} new slip(s); ${result.slips.length - added} were already there`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err: Error) => {
  console.error(`import: FAILED: ${err.message}`);
  process.exit(1);
});
