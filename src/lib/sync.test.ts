import { afterEach, describe, expect, it, vi } from "vitest";
import type { Entry } from "./log";
import { flushPending, loadPending, routeFor, sendOrQueue, type Op } from "./sync";

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

// Trap 2 of the split (docs/specs/split.md): 2.0 shows no coffee or slips, but a phone may still hold
// changes queued under 1.x. The queue picks a route by kind, and a kind it didn't name would fall through
// to its last branch, a slip delete. Every 1.x kind must still reach its own route, with its body.
describe("changes a phone queued under 1.x still reach their old routes", () => {
  // Exactly what 1.x stored under this key: the queue survives an update, so 2.0 reads it as is.
  const queuedUnder1x = [
    { kind: "upsert-coffee", entry: { id: "c1", at: "2026-09-24T12:00:00.000Z", flavour: "Demo roast" } },
    { kind: "upsert-coffee", entry: { id: "c1", at: "2026-09-24T12:00:00.000Z", flavour: "Demo roast", finishedAt: "2026-09-24T12:40:00.000Z" } },
    { kind: "upsert-slip", entry: { id: "s1", vice: "sweets", at: "2026-09-24T20:00:00.000Z", kind: "Candy" } },
    { kind: "delete-coffee", id: "c0" },
    { kind: "upsert-entry", entry: entry("w1") },
    { kind: "delete-slip", id: "s0" },
  ];

  it("flushes every kind to its own route and method, in order, with its body", async () => {
    window.localStorage.setItem("water.pending.v1", JSON.stringify(queuedUnder1x));
    const calls: [string, RequestInit | undefined][] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return Promise.resolve({ ok: true, status: 200 });
    }));
    expect(await flushPending()).toBe(0);
    expect(calls.map(describeCall)).toEqual([
      "POST /api/coffee c1",
      "POST /api/coffee c1",
      "POST /api/slips s1",
      "DELETE /api/coffee/c0",
      "POST /api/entries w1",
      "DELETE /api/slips/s0",
    ]);
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual(queuedUnder1x[1].entry);
    expect(JSON.parse(String(calls[2][1]?.body))).toEqual(queuedUnder1x[2].entry);
    expect(loadPending()).toEqual([]);
  });

  it("names a route for each of the six kinds; no kind is sent as a slip delete by accident", () => {
    const routes = (queuedUnder1x as Op[]).map((op) => `${routeFor(op)[1].method} ${routeFor(op)[0]}`);
    expect(routes).toEqual(["POST /api/coffee", "POST /api/coffee", "POST /api/slips", "DELETE /api/coffee/c0", "POST /api/entries", "DELETE /api/slips/s0"]);
    expect(routeFor({ kind: "delete-entry", id: "w1" })).toEqual(["/api/entries/w1", { method: "DELETE" }]);
  });

  it("a queued coffee the server refuses stays queued, ahead of what came after it", async () => {
    window.localStorage.setItem("water.pending.v1", JSON.stringify([queuedUnder1x[0]]));
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: url !== "/api/coffee", status: url === "/api/coffee" ? 503 : 200 })));
    expect(await sendOrQueue({ kind: "upsert-entry", entry: entry("w2") })).toBe(false);
    expect(loadPending().map((op) => op.kind)).toEqual(["upsert-coffee", "upsert-entry"]);
  });
});
