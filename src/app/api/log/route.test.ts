// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the database: one settings row and a table of drinks keyed by id, enough for the
// route's three queries (read Settings, insert-or-nothing, read back a duplicate).
const db = vi.hoisted(() => {
  const state = { settings: null as unknown, rows: new Map<string, Record<string, unknown>>(), fail: false, inserts: 0 };
  const where = (table: string) => ({
    where: async () => {
      if (state.fail) throw new Error("connect ECONNREFUSED postgresql://u:secret@postgres:5432/x");
      return table === "settings" ? (state.settings ? [{ key: "app", value: state.settings }] : []) : [...state.rows.values()];
    },
  });
  return {
    state,
    getDb: () => ({
      select: () => ({ from: (t: { _name: string }) => where(t._name) }),
      insert: () => ({
        values: (v: Record<string, unknown>) => ({
          onConflictDoNothing: () => ({
            returning: async () => {
              state.inserts++;
              if (state.rows.has(v.id as string)) return [];
              state.rows.set(v.id as string, { ...v, untimed: false });
              return [{ id: v.id }];
            },
          }),
        }),
      }),
    }),
  };
});
vi.mock("@/db", () => ({ getDb: db.getDb, settings: { _name: "settings", key: "key" }, waterEntries: { _name: "water_entries", id: "id" } }));
vi.mock("drizzle-orm", () => ({ eq: () => null }));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/log", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "application/json" } }));

beforeEach(() => {
  db.state.settings = null; // the defaults: Owala 40, Yeti 36, CamelBak 50
  db.state.rows.clear();
  db.state.fail = false;
  db.state.inserts = 0;
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/log", () => {
  it("201: logs a bottle by name with its size from Settings, and says so", async () => {
    db.state.settings = { bottles: [{ id: "yeti", name: "Yeti", oz: 36 }] };
    const res = await post({ bottle: "yeti", fraction: 0.5 });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, message: "Logged 18 oz · ½ Yeti", entry: { bottleId: "yeti", fraction: 0.5, oz: 18 } });
    expect(db.state.rows.size).toBe(1);
    expect([...db.state.rows.values()][0]).toMatchObject({ source: "yeti", fraction: "0.5", oz: "18", untimed: false });
  });

  it("200: the same requestId again logs nothing new and answers with the first drink", async () => {
    const first = await post({ bottle: "Owala", requestId: "owala-1015" });
    expect(first.status).toBe(201);
    const again = await post({ bottle: "Owala", requestId: "owala-1015" });
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ ok: true, duplicate: true, message: "Already logged 40 oz · Owala", entry: { id: "log-owala-1015" } });
    expect(db.state.rows.size).toBe(1);
  });

  it("400: an unknown bottle gets a message the Shortcut can show, and nothing is written", async () => {
    const res = await post({ bottle: "Nalgene" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, message: 'No bottle called "Nalgene". Yours: Owala, Yeti, CamelBak. Or use Other with an amount in oz.' });
    expect(db.state.inserts).toBe(0);
  });

  it("400: a body that isn't JSON", async () => {
    const res = await post("bottle=Yeti");
    expect(res.status).toBe(400);
    expect((await res.json()).message).toMatch(/^Send JSON like/);
  });

  it("503: no database, a plain message and no connection details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.state.fail = true;
    const res = await post({ bottle: "Yeti" });
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ ok: false, message: "Not logged: the server can't reach its database. Log it in the app." });
    expect(text).not.toMatch(/secret|ECONNREFUSED/);
  });
});
