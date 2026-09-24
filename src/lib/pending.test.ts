import { describe, expect, it } from "vitest";
import type { Entry } from "./log";
import { offlineNote, pendingLabel } from "./pending";
import type { Op } from "./sync";

const entry = (id: string): Entry => ({ id, at: "2026-09-24T13:00:00.000Z", bottleId: "yeti", fraction: 1, oz: 36 });
const up = (id: string): Op => ({ kind: "upsert-entry", entry: entry(id) });

describe("pendingLabel", () => {
  it("is nothing when nothing is queued", () => {
    expect(pendingLabel([])).toBeNull();
  });

  it("singular and plural", () => {
    expect(pendingLabel([up("a")])).toBe("1 drink waiting to sync");
    expect(pendingLabel([up("a"), up("b")])).toBe("2 drinks waiting to sync");
    expect(pendingLabel([{ kind: "upsert-coffee", entry: { id: "c", at: "x" } }])).toBe("1 coffee waiting to sync");
  });

  it("counts drinks, not requests: logged then re-timed is one drink", () => {
    expect(pendingLabel([up("a"), up("a"), up("b"), { kind: "delete-entry", id: "b" }])).toBe("2 drinks waiting to sync");
  });

  it("names both when drinks and coffees wait", () => {
    const ops: Op[] = [up("a"), { kind: "upsert-coffee", entry: { id: "c", at: "x" } }, { kind: "delete-coffee", id: "d" }];
    expect(pendingLabel(ops)).toBe("1 drink and 2 coffees waiting to sync");
  });
});

describe("offlineNote", () => {
  it("shows only while the server can't be reached", () => {
    expect(offlineNote(false, [up("a")])).toBeNull();
    expect(offlineNote(true, [up("a"), up("b")])).toBe("2 drinks waiting to sync");
    expect(offlineNote(true, [])).toBe("Can't reach the server");
  });
});
