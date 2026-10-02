// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POOL_OPTIONS, createPool } from "./index";

// No database anywhere in this file: the pool is only constructed (pg connects lazily) and never queried.
const UNREACHABLE = "postgres://user:not-a-real-pw@db.invalid:5432/none";

describe("createPool", () => {
  const pools: ReturnType<typeof createPool>[] = [];
  let errorLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(async () => {
    await Promise.all(pools.splice(0).map((p) => p.end()));
    errorLog.mockRestore();
  });
  const make = () => {
    const pool = createPool(UNREACHABLE);
    pools.push(pool);
    return pool;
  };

  it("has an error listener, so an idle-client error is logged instead of thrown", () => {
    const pool = make();
    expect(pool.listenerCount("error")).toBeGreaterThan(0);
    expect(() => pool.emit("error", new Error("terminating connection due to administrator command"))).not.toThrow();
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(String(errorLog.mock.calls[0][0])).toContain("terminating connection due to administrator command");
  });

  it("keeps serving after repeated errors: the pool is not ended", () => {
    const pool = make();
    pool.emit("error", new Error("boom"));
    pool.emit("error", new Error("boom again"));
    expect(pool.ending).toBe(false);
    expect(pool.ended).toBe(false);
    expect(errorLog).toHaveBeenCalledTimes(2);
  });

  it("never logs the connection string or password", () => {
    const pool = make();
    pool.emit("error", new Error("connection lost"));
    const logged = errorLog.mock.calls.flat().map(String).join("\n");
    expect(logged).not.toContain("not-a-real-pw");
    expect(logged).not.toContain(UNREACHABLE);
  });

  it("sets connect and idle timeouts on the pool", () => {
    expect(POOL_OPTIONS.connectionTimeoutMillis).toBe(5_000);
    expect(POOL_OPTIONS.idleTimeoutMillis).toBe(30_000);
    expect(POOL_OPTIONS.max).toBe(5);
    const options = make().options;
    expect(options.connectionTimeoutMillis).toBe(5_000);
    expect(options.idleTimeoutMillis).toBe(30_000);
    expect(options.max).toBe(5);
  });
});

describe("getDb", () => {
  const saved = process.env.DATABASE_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
    vi.resetModules();
    vi.doUnmock("pg");
  });

  it("stays lazy: importing never needs DATABASE_URL, a call without it throws the same message", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const mod = await import("./index");
    expect(() => mod.getDb()).toThrow("DATABASE_URL is not set. Copy .env.example to .env.");
  });

  it("builds the pool once, with the listener and timeouts attached", async () => {
    const { EventEmitter } = await import("node:events");
    const made: { options: unknown; emitter: InstanceType<typeof EventEmitter> }[] = [];
    vi.resetModules();
    vi.doMock("pg", () => ({
      Pool: class extends EventEmitter {
        constructor(options: unknown) {
          super();
          made.push({ options, emitter: this });
        }
      },
    }));
    process.env.DATABASE_URL = UNREACHABLE;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mod = await import("./index");
    const first = mod.getDb();
    expect(mod.getDb()).toBe(first);
    expect(made).toHaveLength(1);
    expect(made[0].options).toMatchObject({ connectionString: UNREACHABLE, max: 5, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 30_000 });
    // A bare EventEmitter throws on an unhandled "error", exactly as the real pool would crash the process.
    expect(() => made[0].emitter.emit("error", new Error("restart"))).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
