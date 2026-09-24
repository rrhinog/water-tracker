import { describe, expect, it } from "vitest";
import { allDurations, bottleDurations, drinks, durationStats, formatDuration, makeStartEntry } from "./duration";
import { makeCustomEntry, makeEntry, totalOz, type Entry } from "./log";
import { DEFAULT_SETTINGS } from "./settings";

const [owala, yeti] = DEFAULT_SETTINGS.bottles;
const at = (h: number, m = 0) => new Date(2026, 8, 23, h, m);

describe("start marker", () => {
  it("adds nothing to the day's total and is not a drink", () => {
    const start = makeStartEntry(at(6, 15));
    const drink = makeEntry(yeti, 1, at(8, 0));
    expect(totalOz([start, drink])).toBe(36);
    expect(drinks([start, drink])).toEqual([drink]);
  });
});

describe("bottleDurations", () => {
  it("first bottle = finish − start when a start was tapped; later bottles = finish − previous finish", () => {
    const start = makeStartEntry(at(6, 15));
    const b1 = makeEntry(yeti, 1, at(8, 0));
    const b2 = makeEntry(owala, 1, at(10, 30));
    const d = bottleDurations([start, b1, b2]);
    expect(d.get(b1.id)).toEqual({ minutes: 105, ozPerHour: 20.6, fromStart: true });
    expect(d.get(b2.id)).toEqual({ minutes: 150, ozPerHour: 16, fromStart: false });
  });

  it("first bottle has no duration without a start", () => {
    const b1 = makeEntry(yeti, 1, at(8, 0));
    const b2 = makeEntry(yeti, 1, at(9, 0));
    const d = bottleDurations([b1, b2]);
    expect(d.has(b1.id)).toBe(false);
    expect(d.get(b2.id)?.minutes).toBe(60);
  });

  it("a partial pour or one-off cup is a finish like any other", () => {
    const start = makeStartEntry(at(7, 0));
    const half = makeEntry(yeti, 0.5, at(7, 30));
    const cup = makeCustomEntry(12, at(8, 0));
    const d = bottleDurations([start, half, cup]);
    expect(d.get(half.id)).toEqual({ minutes: 30, ozPerHour: 36, fromStart: true });
    expect(d.get(cup.id)).toEqual({ minutes: 30, ozPerHour: 24, fromStart: false });
  });

  it("skips untimed backfill rows without breaking the chain", () => {
    const untimed: Entry = { id: "u", at: at(23, 59).toISOString(), bottleId: "yeti", fraction: 1, oz: 36, untimed: true };
    const b1 = makeEntry(yeti, 1, at(8, 0));
    const b2 = makeEntry(yeti, 1, at(9, 0));
    const d = bottleDurations([untimed, b1, b2]);
    expect(d.has("u")).toBe(false);
    expect(d.get(b2.id)?.minutes).toBe(60);
  });

  it("ignores a start tapped after a finish", () => {
    const b1 = makeEntry(yeti, 1, at(8, 0));
    const lateStart = makeStartEntry(at(8, 5));
    const b2 = makeEntry(yeti, 1, at(9, 0));
    expect(bottleDurations([b1, lateStart, b2]).get(b2.id)?.minutes).toBe(60);
  });
});

describe("durationStats", () => {
  it("medians full bottles only and buckets oz/hour by finish hour across days", () => {
    const day1 = [makeStartEntry(at(6, 0)), makeEntry(yeti, 1, at(8, 0)), makeEntry(yeti, 1, at(9, 0)), makeCustomEntry(8, at(9, 30))];
    const day2 = [makeStartEntry(new Date(2026, 8, 24, 6, 0)), makeEntry(owala, 1, new Date(2026, 8, 24, 8, 0)), makeEntry(owala, 0.5, new Date(2026, 8, 24, 9, 0))];
    const s = durationStats([...day1, ...day2]);
    expect(s.fullBottles).toBe(3); // 120, 60, 120 → median 120; the half and the cup are excluded
    expect(s.medianFullBottleMinutes).toBe(120);
    const eight = s.byHour.find((b) => b.hour === 8)!;
    expect(eight.drinks).toBe(2);
    expect(eight.ozPerHour).toBe(19); // median of 18 (yeti) and 20 (owala)
    expect(allDurations([...day1, ...day2]).size).toBe(5);
  });

  it("is empty with no timed pairs", () => {
    expect(durationStats([makeEntry(yeti, 1, at(8, 0))])).toEqual({ medianFullBottleMinutes: null, fullBottles: 0, byHour: [] });
  });
});

describe("formatDuration", () => {
  it("reads as hours and minutes", () => {
    expect(formatDuration(105)).toBe("1h 45m");
    expect(formatDuration(48)).toBe("48m");
  });
});
