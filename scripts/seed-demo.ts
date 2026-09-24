// Fill a staging or demo database with generated demo data (src/lib/demo.ts).
//
//   bun scripts/seed-demo.ts staging           # STAGING_DATABASE_URL_FROM_HOST
//   bun scripts/seed-demo.ts                   # DATABASE_URL
//   bun scripts/seed-demo.ts staging --reset   # clear the three app tables first
//
// Hard guard: refuses any database whose name does not end in _staging or _demo, before it
// connects. Without --reset it also refuses a database that already has rows. Everything runs
// in one transaction. Run scripts/migrate.ts against the same database first.
import { Client } from "pg";
import { HOST_URL_VAR, assertSeedTarget, isTarget } from "../src/lib/dbtarget";
import { generateDemoData } from "../src/lib/demo";

async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes("--reset");
  const target = args.find((a) => !a.startsWith("--"));
  if (target === "live") throw new Error("refusing to seed live");
  if (target !== undefined && !isTarget(target)) throw new Error(`unknown target "${target}" (staging)`);
  const url = target ? process.env[HOST_URL_VAR[target]] : process.env.DATABASE_URL;
  const name = assertSeedTarget(url);

  const { water, coffee, settings } = generateDemoData(new Date());
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    await client.query("BEGIN");
    if (reset) {
      await client.query("TRUNCATE water_entries, coffee_entries, settings");
    } else {
      const { rows } = await client.query<{ n: string }>(
        "SELECT (SELECT count(*) FROM water_entries) + (SELECT count(*) FROM coffee_entries) + (SELECT count(*) FROM settings) AS n",
      );
      if (Number(rows[0].n) > 0) throw new Error(`${name} already has data; pass --reset to replace it`);
    }
    for (const e of water) {
      await client.query("INSERT INTO water_entries (id, at, source, fraction, oz, untimed) VALUES ($1, $2, $3, $4, $5, $6)", [
        e.id, e.at, e.bottleId, e.fraction, e.oz, e.untimed ?? false,
      ]);
    }
    for (const c of coffee) {
      await client.query("INSERT INTO coffee_entries (id, at, from_notes, finished_at, flavour) VALUES ($1, $2, false, $3, $4)", [
        c.id, c.at, c.finishedAt ?? null, c.flavour ?? null,
      ]);
    }
    await client.query("INSERT INTO settings (key, value) VALUES ('app', $1)", [JSON.stringify(settings)]);
    await client.query("COMMIT");
    console.log(`seed: ${name} now has ${water.length} water rows, ${coffee.length} coffees and default settings`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err: Error) => {
  console.error(`seed: FAILED: ${err.message}`);
  process.exit(1);
});
