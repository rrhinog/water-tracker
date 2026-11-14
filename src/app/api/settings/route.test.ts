// @vitest-environment node
// Trap 1 of the split, end to end through the route: PUT replaces the whole settings row, so it must
// carry the fields only 1.x reads (flavours, vices, pact) over from the stored row.
import { beforeEach, describe, expect, it, vi } from "vitest";

// One settings row in memory, behind the few query-builder calls the route makes.
const db = vi.hoisted(() => {
  const state: { row: { key: string; value: unknown } | null; locked: number } = { row: null, locked: 0 };
  const select = () => ({
    from: () => ({
      where: () => {
        const rows = () => (state.row ? [{ ...state.row }] : []);
        return Object.assign(Promise.resolve(rows()), { for: (mode: string) => { if (mode === "update") state.locked++; return Promise.resolve(rows()); } });
      },
    }),
  });
  const insert = () => ({
    values: (v: { key: string; value: unknown }) => ({
      onConflictDoUpdate: (c: { set: { value: unknown } }) => {
        state.row = { key: v.key, value: JSON.parse(JSON.stringify(state.row ? c.set.value : v.value)) };
        return Promise.resolve();
      },
    }),
  });
  const tx = { select, insert };
  return { state, handle: { select, insert, transaction: (f: (t: typeof tx) => Promise<unknown>) => f(tx) } };
});
vi.mock("@/db", () => ({ getDb: () => db.handle, settings: { key: "key" } }));

import { GET, PUT } from "./route";

const stored1x = {
  bottles: [{ id: "yeti", name: "Yeti", oz: 36 }], floorOz: 100, unit: "oz", paceStartH: 6, paceEndH: 21, defaultPaceMode: "history", accent: "#111111", stepsFloor: 10000,
  flavours: ["Demo roast", "Bought out"],
  vices: [{ id: "sweets", name: "Sweets", chips: ["Candy"], cleanSince: "2026-03-01" }],
  pact: { name: "Demo pact", start: "2026-03-01", days: 100, quits: ["sweets", "coffee"] },
};
const put = (body: unknown) => PUT(new Request("http://test/api/settings", { method: "PUT", body: JSON.stringify(body), headers: { "content-type": "application/json" } }));

beforeEach(() => {
  db.state.row = { key: "app", value: structuredClone(stored1x) };
  db.state.locked = 0;
});

describe("/api/settings in 2.0", () => {
  it("GET sends only the 2.0 fields, with the Floors counting from the old Pact's Day 1", async () => {
    const s = await (await GET()).json();
    expect(s).not.toHaveProperty("vices");
    expect(s).not.toHaveProperty("pact");
    expect(s).not.toHaveProperty("flavours");
    expect(s.floorsFrom).toBe("2026-03-01");
  });

  it("PUT from the 2.0 Settings page keeps the stored flavours, vices and pact", async () => {
    const page = await (await GET()).json();
    const res = await put({ ...page, floorOz: 120 });
    expect(res.status).toBe(200);
    const row = db.state.row!.value as typeof stored1x;
    expect(row.floorOz).toBe(120);
    expect(row.flavours).toEqual(stored1x.flavours);
    expect(row.vices).toEqual(stored1x.vices);
    expect(row.pact).toEqual(stored1x.pact);
    expect(db.state.locked).toBe(1); // read under a row lock, in the same transaction as the write
  });

  it("the row a 1.9.1 rollback would read after two 2.0 saves still has every vice and the Pact", async () => {
    await put({ ...(await (await GET()).json()), unit: "ml" });
    await put({ ...(await (await GET()).json()), floorsFrom: null });
    const row = db.state.row!.value as Record<string, unknown>;
    expect(JSON.stringify(row.vices)).toBe(JSON.stringify(stored1x.vices));
    expect(JSON.stringify(row.pact)).toBe(JSON.stringify(stored1x.pact));
    expect(JSON.stringify(row.flavours)).toBe(JSON.stringify(stored1x.flavours));
  });

  it("a fresh install's first save stores no 1.x fields", async () => {
    db.state.row = null;
    await put({ floorOz: 90 });
    expect(Object.keys(db.state.row!.value as object)).not.toContain("vices");
    expect(Object.keys(db.state.row!.value as object)).not.toContain("pact");
  });
});
