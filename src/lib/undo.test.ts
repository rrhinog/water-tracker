import { describe, expect, it } from "vitest";
import { makeUndo, UNDO_MS, undoMessage, undoOpen } from "./undo";

describe("undo window", () => {
  it("is about six seconds", () => {
    expect(UNDO_MS).toBe(6000);
  });

  it("is open from the log until the window ends, then closed", () => {
    const u = makeUndo("entry", "a", "Logged 36 oz", 1_000);
    expect(undoOpen(u, 1_000)).toBe(true);
    expect(undoOpen(u, 1_000 + UNDO_MS - 1)).toBe(true);
    expect(undoOpen(u, 1_000 + UNDO_MS)).toBe(false);
    expect(undoOpen(null, 1_000)).toBe(false);
  });

  it("keeps what it will remove", () => {
    expect(makeUndo("coffee", "c1", "Logged a coffee", 0)).toEqual({ kind: "coffee", id: "c1", message: "Logged a coffee", until: UNDO_MS });
  });
});

describe("undoMessage", () => {
  it("says what was logged, in Ryan's words", () => {
    expect(undoMessage({ amount: "36 oz" })).toBe("Logged 36 oz");
    expect(undoMessage("coffee")).toBe("Logged a coffee");
  });

  it("says when it went to yesterday", () => {
    expect(undoMessage({ amount: "40 oz", yesterday: true })).toBe("Logged 40 oz for yesterday");
  });
});
