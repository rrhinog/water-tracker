import { describe, expect, it } from "vitest";
import { backupFileName, compareCounts, dumpCommand, parseCounts, pgConnection, tablesInDump } from "./backup";

const url = "postgresql://water_tracker_app:p%40ss%2Fword@127.0.0.1:5432/water_tracker";

describe("pgConnection", () => {
  it("splits a URL and decodes the parts", () => {
    expect(pgConnection(url)).toEqual({ host: "127.0.0.1", port: "5432", user: "water_tracker_app", password: "p@ss/word", database: "water_tracker" });
  });
  it("defaults the port and refuses a URL without a database or of another kind", () => {
    expect(pgConnection("postgres://u:p@db/x").port).toBe("5432");
    expect(() => pgConnection("postgres://u:p@db:5432")).toThrow(/no database/);
    expect(() => pgConnection("mysql://u:p@db/x")).toThrow();
  });
});

describe("backupFileName", () => {
  it("names the database, the version and the local time, sortable", () => {
    expect(backupFileName("water_tracker", "v1.9.0", new Date(2026, 9, 17, 9, 5))).toBe("water_tracker_pre_v1.9.0_2026-10-17_0905.dump");
  });
  it("replaces characters a file system might reject", () => {
    expect(backupFileName("water_tracker", "feat/x y:z", new Date(2026, 0, 2, 3, 4))).toBe("water_tracker_pre_feat-x-y-z_2026-01-02_0304.dump");
  });
});

describe("dumpCommand", () => {
  const c = pgConnection(url);
  it("runs inside the Postgres container against its own server, password only via PGPASSWORD", () => {
    const cmd = dumpCommand(c, "00000003-1", "postgres");
    expect(cmd.slice(0, 7)).toEqual(["docker", "exec", "-i", "-e", "PGPASSWORD", "postgres", "pg_dump"]);
    expect(cmd).toContain("--snapshot=00000003-1");
    expect(cmd).toContain("--format=custom");
    expect(cmd.join(" ")).not.toContain("p@ss/word");
  });
  it("uses this machine's pg_dump and the URL's host without a container", () => {
    const cmd = dumpCommand(c, "s");
    expect(cmd.slice(0, 5)).toEqual(["pg_dump", "-h", "127.0.0.1", "-p", "5432"]);
    expect(cmd.join(" ")).not.toContain("p@ss/word");
  });
});

describe("tablesInDump", () => {
  it("lists the tables whose rows are in the file", () => {
    const listing = [
      ";",
      "; Archive created at 2026-10-01 18:00:00 EDT",
      "215; 1259 16390 TABLE public water_entries water_tracker_app",
      "3368; 0 16390 TABLE DATA public water_entries water_tracker_app",
      "3369; 0 16401 TABLE DATA public coffee_entries water_tracker_app",
      "3370; 0 16410 TABLE DATA public settings water_tracker_app",
    ].join("\r\n");
    expect(tablesInDump(listing)).toEqual(["coffee_entries", "settings", "water_entries"]);
  });
});

describe("restore check verdict", () => {
  it("reads psql's 'table count' lines and ignores the rest", () => {
    expect(parseCounts("coffee_entries 28\nschema_migrations 5\r\nNOTICE: x\n\nsettings 1\n")).toEqual({ coffee_entries: 28, schema_migrations: 5, settings: 1 });
  });
  it("passes only when every table is there with the same count", () => {
    const backedUp = { water_entries: 275, coffee_entries: 28, settings: 1 };
    expect(compareCounts(backedUp, { ...backedUp }).ok).toBe(true);
    const missing = compareCounts(backedUp, { water_entries: 275, coffee_entries: 28 });
    expect(missing.ok).toBe(false);
    expect(missing.lines).toContain("DIFF settings: backed up 1, restored -");
    expect(compareCounts(backedUp, { ...backedUp, water_entries: 274 }).ok).toBe(false);
  });
  it("never passes an empty restore", () => {
    expect(compareCounts({}, {}).ok).toBe(false);
  });
});
