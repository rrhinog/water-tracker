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
    expect(makeUndo("entry", "w1", "Logged 36 oz", 0)).toEqual({ kind: "entry", id: "w1", message: "Logged 36 oz", until: UNDO_MS });
  });
});

describe("undoMessage", () => {
  it("says what was logged, in plain words", () => {
    expect(undoMessage({ amount: "36 oz" })).toBe("Logged 36 oz");
  });

  it("says when it went to yesterday", () => {
    expect(undoMessage({ amount: "40 oz", yesterday: true })).toBe("Logged 40 oz for yesterday");
  });
});
