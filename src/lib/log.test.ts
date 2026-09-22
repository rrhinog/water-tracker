import { describe, expect, it } from "vitest";
import { dayKey, entriesForDay, makeCustomEntry, makeEntry, ouncesFor, recentCustomAmounts, totalOz } from "./log";
import { DEFAULT_SETTINGS } from "./settings";

const [owala, yeti, camelbak] = DEFAULT_SETTINGS.bottles;

describe("ouncesFor", () => {
  it("matches the acceptance checklist examples", () => {
    expect(ouncesFor(yeti, 1)).toBe(36);
    expect(ouncesFor(owala, 0.5)).toBe(20);
    expect(ouncesFor(camelbak, 0.25)).toBe(12.5);
  });
});

describe("totalOz", () => {
  it("sums entries and avoids float drift", () => {
    const a = makeEntry(camelbak, 0.25, new Date(2026, 8, 22, 8, 0));
    const b = makeEntry(camelbak, 0.75, new Date(2026, 8, 22, 12, 0));
    expect(totalOz([a, b])).toBe(50);
  });
});

describe("day boundary", () => {
  it("rolls over at local midnight, not UTC", () => {
    expect(dayKey(new Date(2026, 8, 22, 23, 59))).toBe("2026-09-22");
    expect(dayKey(new Date(2026, 8, 23, 0, 1))).toBe("2026-09-23");
  });

  it("hides yesterday's entries from today without deleting them", () => {
    const yesterday = makeEntry(yeti, 1, new Date(2026, 8, 21, 20, 0));
    const today = makeEntry(yeti, 1, new Date(2026, 8, 22, 9, 0));
    const all = [yesterday, today];
    expect(entriesForDay(all, new Date(2026, 8, 22, 15, 0))).toEqual([today]);
    expect(all).toHaveLength(2);
  });
});

describe("one-off amounts", () => {
  it("records a custom amount as an Other entry", () => {
    const e = makeCustomEntry(16.9, new Date(2026, 8, 22, 12, 40));
    expect(e.bottleId).toBe("other");
    expect(e.oz).toBe(16.9);
  });

  it("lists distinct recent amounts, most recent first, ignoring bottles and untimed backfill", () => {
    const t = (h: number) => new Date(2026, 8, 22, h, 0);
    const entries = [
      makeCustomEntry(30, t(8)),
      makeEntry(yeti, 1, t(9)),
      makeCustomEntry(16.9, t(10)),
      makeCustomEntry(30, t(11)),
      makeCustomEntry(12, t(12)),
      { ...makeCustomEntry(77, t(13)), untimed: true },
    ];
    expect(recentCustomAmounts(entries)).toEqual([12, 30, 16.9]);
    expect(recentCustomAmounts(entries, 2)).toEqual([12, 30]);
  });
});
