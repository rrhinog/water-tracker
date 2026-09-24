// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
vi.mock("@/db", () => ({ getDb: () => ({ execute }) }));

import { GET } from "./route";
import { appVersion } from "@/lib/health";
import pkg from "../../../../package.json";

afterEach(() => {
  execute.mockReset();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/health", () => {
  it("200 with version when the database answers", async () => {
    vi.stubEnv("GIT_SHA", "abc1234");
    execute.mockResolvedValue({ rows: [{ "?column?": 1 }] });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, version: `${pkg.version}+abc1234`, db: true });
  });

  it("503 with ok:false when the database is down, and no error detail in the body", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    execute.mockRejectedValue(new Error("connect ECONNREFUSED postgresql://u:secret@postgres:5432/x"));
    const res = await GET();
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: false, version: pkg.version, db: false });
    expect(text).not.toMatch(/secret|ECONNREFUSED/);
  });
});

describe("appVersion", () => {
  it("adds a sha only when it looks like one", () => {
    expect(appVersion("1.6.0", undefined)).toBe("1.6.0");
    expect(appVersion("1.6.0", "dev")).toBe("1.6.0");
    expect(appVersion("1.6.0", " 0a1b2c3\n")).toBe("1.6.0+0a1b2c3");
  });
});

describe("checkHealth", () => {
  it("times out a hanging database", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { checkHealth } = await import("@/lib/health");
    const r = await checkHealth(() => new Promise(() => {}), "1.6.0", 20);
    expect(r.status).toBe(503);
  });
});
