import { afterEach, describe, expect, it, vi } from "vitest";
import type { Entry } from "./log";
import { flushPending, loadPending, sendOrQueue } from "./sync";

const entry = (id: string): Entry => ({ id, at: "2026-09-24T13:00:00.000Z", bottleId: "yeti", fraction: 1, oz: 36 });
const describeCall = ([url, init]: [string, RequestInit | undefined]) => `${init?.method ?? "GET"} ${url}${init?.body ? ` ${JSON.parse(String(init.body)).id}` : ""}`;

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("the send queue", () => {
  it("a new change waits behind older queued ones, so an undo never reaches the server first", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    expect(await sendOrQueue({ kind: "upsert-entry", entry: entry("a") })).toBe(false);
    expect(loadPending()).toHaveLength(1);

    const calls: [string, RequestInit | undefined][] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    }));
    expect(await sendOrQueue({ kind: "delete-entry", id: "a" })).toBe(true);
    expect(calls.map(describeCall)).toEqual(["POST /api/entries a", "DELETE /api/entries/a"]);
    expect(loadPending()).toEqual([]);
  });

  it("stops at the first failure and keeps the rest, in order", async () => {
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(() => (n++ === 1 ? Promise.reject(new Error("drop")) : Promise.resolve({ ok: true, status: 200 }))));
    await sendOrQueue({ kind: "upsert-entry", entry: entry("a") }); // sent
    expect(await sendOrQueue({ kind: "upsert-entry", entry: entry("b") })).toBe(false); // fails, queued
    expect(loadPending().map((op) => (op.kind === "upsert-entry" ? op.entry.id : op.kind))).toEqual(["b"]);
  });

  it("overlapping flushes run one at a time: every op is sent exactly once, in order", async () => {
    const sent: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      await new Promise((r) => setTimeout(r, 5));
      sent.push(describeCall([url, init]));
      return { ok: true, status: 200 };
    }));
    const a = sendOrQueue({ kind: "upsert-entry", entry: entry("a") });
    const b = sendOrQueue({ kind: "upsert-entry", entry: entry("b") });
    const c = sendOrQueue({ kind: "delete-entry", id: "a" });
    const flush = flushPending();
    expect(await Promise.all([a, b, c, flush])).toEqual([true, true, true, 0]);
    expect(sent).toEqual(["POST /api/entries a", "POST /api/entries b", "DELETE /api/entries/a"]);
  });
});
