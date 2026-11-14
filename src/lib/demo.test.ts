import { describe, expect, it } from "vitest";
import { FRACTIONS } from "./bottles";
import { STARTED, bottleDurations } from "./duration";
import { DEMO_DAYS, DEMO_FLOORS_DAYS_IN, generateDemoData, seededRandom } from "./demo";
import { dayKey, entriesForDay } from "./log";
import { DEFAULT_SETTINGS, normalizeSettings } from "./settings";

const NOW = new Date(2026, 8, 24, 15, 30); // local 3:30 pm

describe("seededRandom", () => {
  it("repeats for the same seed and stays in [0, 1)", () => {
    const a = seededRandom(7), b = seededRandom(7);
    const xs = Array.from({ length: 200 }, () => a());
    expect(xs).toEqual(Array.from({ length: 200 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe("generateDemoData", () => {
  const data = generateDemoData(NOW);

  it("is deterministic for the same now and seed, and different for another seed", () => {
    expect(generateDemoData(NOW)).toEqual(data);
    expect(generateDemoData(NOW, { seed: 2 }).water).not.toEqual(data.water);
  });

  it("covers the requested days, ending today, never in the future", () => {
    const days = new Set(data.water.map((e) => dayKey(new Date(e.at))));
    expect(days.size).toBe(DEMO_DAYS);
    expect(days.has(dayKey(NOW))).toBe(true);
    expect(days.has(dayKey(new Date(2026, 8, 24 - DEMO_DAYS + 1)))).toBe(true);
    const all = data.water.map((e) => e.at);
    expect(all.every((t) => new Date(t).getTime() <= NOW.getTime())).toBe(true);
  });

  it("produces rows the tables accept", () => {
    const ids = new Set<string>();
    const sources = new Set([...DEFAULT_SETTINGS.bottles.map((b) => b.id), "other", STARTED]);
    for (const e of data.water) {
      ids.add(e.id);
      expect(sources.has(e.bottleId)).toBe(true);
      expect(FRACTIONS).toContain(e.fraction);
      if (e.bottleId === STARTED) expect(e.oz).toBe(0);
      else expect(e.oz).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(e.at))).toBe(false);
    }
    expect(ids.size).toBe(data.water.length);
  });

  it("uses DEFAULT_SETTINGS (a copy, not the shared object) with a demo count-from date for the Floors", () => {
    const { floorsFrom, ...rest } = data.settings;
    const { floorsFrom: _f, ...defaults } = DEFAULT_SETTINGS;
    void _f;
    expect(rest).toEqual(defaults);
    expect(data.settings).not.toBe(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.floorsFrom).toBeNull();
    expect(floorsFrom).toBe(dayKey(new Date(2026, 8, 24 - DEMO_FLOORS_DAYS_IN)));
    expect(normalizeSettings(data.settings)).toEqual(data.settings);
  });

  it("has nothing but water, steps and settings", () => {
    expect(Object.keys(data).sort()).toEqual(["settings", "steps", "water"]);
  });

  it("makes a steps row per day, today's as of a sync that already happened", () => {
    expect(data.steps).toHaveLength(DEMO_DAYS);
    const today = data.steps.at(-1)!;
    expect(today.day).toBe(dayKey(NOW));
    expect(new Date(today.syncedAt)).toEqual(new Date(2026, 8, 24, 12));
    expect(generateDemoData(new Date(2026, 8, 24, 5)).steps.at(-1)!.day).toBe("2026-09-23");
  });

  it("gives today a started marker that times the first bottle", () => {
    const today = entriesForDay(data.water, NOW);
    expect(today.some((e) => e.bottleId === STARTED)).toBe(true);
    const firstDrink = today.find((e) => e.bottleId !== STARTED)!;
    expect(bottleDurations(today).get(firstDrink.id)?.fromStart).toBe(true);
  });

  it("still marks today as started just after midnight", () => {
    const early = new Date(2026, 8, 24, 0, 5);
    const today = entriesForDay(generateDemoData(early).water, early);
    expect(today.map((e) => e.bottleId)).toEqual([STARTED]);
  });

  it("leaves past days near the floor", () => {
    const yesterday = entriesForDay(data.water, new Date(2026, 8, 23)).reduce((s, e) => s + e.oz, 0);
    expect(yesterday).toBeGreaterThan(50);
  });
});
