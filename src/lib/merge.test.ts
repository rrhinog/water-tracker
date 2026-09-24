import { describe, expect, it } from "vitest";
import type { Entry } from "./log";
import { mergeWithServer } from "./merge";

const row = (id: string, h: number): Entry => ({ id, at: `2026-09-23T${String(h).padStart(2, "0")}:00:00.000Z`, bottleId: "yeti", fraction: 1, oz: 36 });

describe("mergeWithServer", () => {
  it("drops a cached row the server no longer has (deleted elsewhere); it is never re-uploaded", () => {
    const server = [row("a", 9)];
    const local = [row("a", 9), row("deleted-on-desktop", 10)];
    expect(mergeWithServer(server, local, [], "entry").map((r) => r.id)).toEqual(["a"]);
  });

  it("keeps a row logged offline that is still waiting to be sent", () => {
    const offline = row("offline", 11);
    const merged = mergeWithServer([row("a", 9)], [row("a", 9), offline], [{ kind: "upsert-entry", entry: offline }], "entry");
    expect(merged.map((r) => r.id)).toEqual(["a", "offline"]);
  });

  it("hides a row whose delete is still queued", () => {
    const merged = mergeWithServer([row("a", 9), row("b", 10)], [row("a", 9)], [{ kind: "delete-entry", id: "b" }], "entry");
    expect(merged.map((r) => r.id)).toEqual(["a"]);
  });

  it("only looks at queued ops of its own kind", () => {
    const offline = row("x", 11);
    expect(mergeWithServer([], [offline], [{ kind: "upsert-coffee", entry: { id: "x", at: offline.at } }], "entry")).toEqual([]);
  });

  it("returns rows oldest first", () => {
    expect(mergeWithServer([row("late", 12), row("early", 8)], [], [], "entry").map((r) => r.id)).toEqual(["early", "late"]);
  });
});

describe("mergeWithServer with queued edits", () => {
  it("a queued change to a row the server has (an edited time) beats the server's older copy", () => {
    const edited = { ...row("a", 9), at: "2026-09-23T06:00:00.000Z" };
    const merged = mergeWithServer([row("a", 9), row("b", 10)], [edited, row("b", 10)], [{ kind: "upsert-entry", entry: edited }], "entry");
    expect(merged).toEqual([edited, row("b", 10)]);
  });
});
