import { describe, expect, it } from "vitest";
import { assertSeedTarget, checkTarget, databaseName, isDisposableDatabase } from "./dbtarget";

const url = (db: string, host = "127.0.0.1") => `postgresql://app:secret@${host}:5432/${db}`;

describe("databaseName", () => {
  it("reads the path, ignoring query options", () => {
    expect(databaseName(url("water_tracker_staging") + "?sslmode=disable")).toBe("water_tracker_staging");
    expect(databaseName("postgres://u@h:5432")).toBe("");
  });
  it("rejects a non-postgres URL", () => {
    expect(() => databaseName("mysql://u@h/db")).toThrow();
  });
});

describe("seed guard", () => {
  it("refuses the live database", () => {
    expect(() => assertSeedTarget(url("water_tracker"))).toThrow(/refusing to seed "water_tracker"/);
  });
  it("accepts water_tracker_staging and *_demo", () => {
    expect(assertSeedTarget(url("water_tracker_staging"))).toBe("water_tracker_staging");
    expect(assertSeedTarget(url("water_tracker_demo"))).toBe("water_tracker_demo");
  });
  it("refuses near misses, other databases and a missing URL", () => {
    for (const db of ["water_tracker_staging_old", "staging", "postgres", "water_tracker-staging", ""]) {
      expect(() => assertSeedTarget(url(db))).toThrow();
    }
    expect(() => assertSeedTarget(undefined)).toThrow();
  });
  it("never echoes the password", () => {
    expect(() => assertSeedTarget(url("water_tracker"))).not.toThrow(/secret/);
  });
  it("isDisposableDatabase", () => {
    expect(isDisposableDatabase("water_tracker_staging")).toBe(true);
    expect(isDisposableDatabase("water_tracker")).toBe(false);
  });
});

describe("checkTarget", () => {
  it("accepts a matching staging pair", () => {
    expect(checkTarget("staging", url("water_tracker_staging"), url("water_tracker_staging", "postgres"))).toBe("water_tracker_staging");
  });
  it("refuses staging on the live database", () => {
    expect(() => checkTarget("staging", url("water_tracker"))).toThrow(/own database/);
  });
  it("refuses live on a staging database", () => {
    expect(() => checkTarget("live", url("water_tracker_staging"))).toThrow(/staging\/demo/);
  });
  it("refuses host and container URLs that name different databases", () => {
    expect(() => checkTarget("live", url("water_tracker"), url("other", "postgres"))).toThrow(/different databases/);
  });
  it("needs the host URL", () => {
    expect(() => checkTarget("live", undefined)).toThrow(/LIVE_DATABASE_URL_FROM_HOST/);
  });
});
