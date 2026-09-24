import { describe, expect, it } from "vitest";
import { byTime, dayKey, entriesForDay, lastDrink, makeCustomEntry, makeEntry, ouncesFor, recentCustomAmounts, refillOf, totalOz } from "./log";
import { makeStartEntry } from "./duration";
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

describe("refill", () => {
  const t = (h: number, m = 0) => new Date(2026, 8, 24, h, m);

  it("repeats the last drink: new id, now, same bottle, fraction and ounces", () => {
    const last = makeEntry(yeti, 0.5, t(9));
    const again = refillOf(last, t(11, 20));
    expect(again.id).not.toBe(last.id);
    expect(again.at).toBe(t(11, 20).toISOString());
    expect({ bottleId: again.bottleId, fraction: again.fraction, oz: again.oz }).toEqual({ bottleId: "yeti", fraction: 0.5, oz: 18 });
    expect(again.untimed).toBeUndefined();
  });

  it("works for a one-off Other amount too", () => {
    const again = refillOf(makeCustomEntry(16.9, t(9)), t(10));
    expect({ bottleId: again.bottleId, fraction: again.fraction, oz: again.oz }).toEqual({ bottleId: "other", fraction: 1, oz: 16.9 });
  });

  it("the last drink is the latest by time, skipping start markers and untimed backfill", () => {
    const a = makeEntry(yeti, 1, t(9));
    const b = makeCustomEntry(12, t(12)); // logged earlier in the list order, but later in the day
    const start = makeStartEntry(t(13));
    const untimed = { ...makeEntry(camelbak, 1, t(23, 59)), untimed: true };
    expect(lastDrink([b, a, start, untimed])).toBe(b);
    expect(lastDrink([start])).toBeNull();
    expect(lastDrink([])).toBeNull();
  });
});

describe("byTime", () => {
  it("sorts oldest first without touching the input (a re-timed or yesterday row lands in place)", () => {
    const late = makeEntry(yeti, 1, new Date(2026, 8, 24, 15, 0));
    const early = makeEntry(yeti, 1, new Date(2026, 8, 23, 21, 0));
    const input = [late, early];
    expect(byTime(input)).toEqual([early, late]);
    expect(input[0]).toBe(late);
  });
});
