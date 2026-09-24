import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { migrationFiles, pendingMigrations, stripOwnTransaction, summarize, unknownApplied } from "./migrations";

const FILES = ["0002_coffee_finished.sql", "0000_init.sql", "README.md", "0001_settings.sql", "0010_later.sql", "meta.json"];

describe("pendingMigrations", () => {
  it("orders by number and skips non-migration files", () => {
    expect(migrationFiles(FILES)).toEqual(["0000_init.sql", "0001_settings.sql", "0002_coffee_finished.sql", "0010_later.sql"]);
  });
  it("everything is pending on a fresh database", () => {
    expect(pendingMigrations(FILES, [])).toEqual(migrationFiles(FILES));
  });
  it("only what is not recorded, in order", () => {
    expect(pendingMigrations(FILES, ["0000_init.sql", "0002_coffee_finished.sql"])).toEqual(["0001_settings.sql", "0010_later.sql"]);
  });
  it("nothing when all are recorded", () => {
    expect(pendingMigrations(FILES, migrationFiles(FILES))).toEqual([]);
  });
  it("reports recorded files that no longer exist", () => {
    expect(unknownApplied(FILES, ["0000_init.sql", "0003_gone.sql"])).toEqual(["0003_gone.sql"]);
  });
  it("every file in drizzle/ is named so the runner picks it up", () => {
    const real = readdirSync(path.join(__dirname, "..", "..", "drizzle")).filter((f) => f.endsWith(".sql"));
    expect(migrationFiles(real)).toEqual([...real].sort());
  });
});

describe("stripOwnTransaction", () => {
  it("removes a file's own BEGIN/COMMIT lines and keeps the rest", () => {
    const sql = "-- note\r\nBEGIN;\nALTER TABLE t ADD c int;\n  commit ;\n";
    expect(stripOwnTransaction(sql)).toBe("-- note\nALTER TABLE t ADD c int;\n");
  });
  it("leaves BEGIN inside other statements alone", () => {
    const sql = "CREATE FUNCTION f() RETURNS int AS $$ BEGIN RETURN 1; END $$ LANGUAGE plpgsql;";
    expect(stripOwnTransaction(sql)).toBe(sql);
  });
});

describe("summarize", () => {
  it("up to date, or one line per file", () => {
    expect(summarize([])).toEqual(["migrations: up to date"]);
    expect(summarize(["0005_x.sql"])).toEqual(["migrations: applied 0005_x.sql"]);
  });
});
