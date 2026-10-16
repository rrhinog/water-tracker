import { describe, expect, it } from "vitest";
import { FRACTIONS } from "./bottles";
import { STARTED, bottleDurations } from "./duration";
import { DEMO_DAYS, DEMO_PACT_DAYS_IN, DEMO_VICES, generateDemoData, seededRandom } from "./demo";
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
    const all = [...data.water.map((e) => e.at), ...data.coffee.flatMap((c) => [c.at, c.finishedAt ?? c.at])];
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
    for (const c of data.coffee) {
      ids.add(c.id);
      expect(DEFAULT_SETTINGS.flavours).toContain(c.flavour);
      if (c.finishedAt) expect(c.finishedAt > c.at).toBe(true);
    }
    expect(ids.size).toBe(data.water.length + data.coffee.length);
    expect(data.coffee.length).toBeGreaterThan(5);
  });

  it("uses DEFAULT_SETTINGS (a copy, not the shared object) with the demo vices and Pact switched on", () => {
    const { vices, pact, ...rest } = data.settings;
    const { vices: _v, pact: _p, ...defaults } = DEFAULT_SETTINGS;
    void _v; void _p;
    expect(rest).toEqual(defaults);
    expect(data.settings).not.toBe(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.vices).toEqual([]);
    expect(vices.map((v) => v.id)).toEqual(DEMO_VICES.map((v) => v.id));
    expect(pact).toEqual({ name: "100-day Pact", start: dayKey(new Date(2026, 8, 24 - DEMO_PACT_DAYS_IN)), days: 100, quits: ["alcohol", "sweets", "coffee"] });
    expect(normalizeSettings(data.settings)).toEqual(data.settings);
  });

  it("makes demo slips on demo vices with their chips, none in the future or the three days before today", () => {
    expect(data.slips.length).toBeGreaterThan(5);
    for (const s of data.slips) {
      const vice = DEMO_VICES.find((v) => v.id === s.vice)!;
      expect(vice.chips).toContain(s.kind);
      expect(new Date(s.at).getTime()).toBeLessThanOrEqual(NOW.getTime());
    }
    for (let back = 1; back <= 3; back++) {
      const k = dayKey(new Date(2026, 8, 24 - back));
      expect(data.slips.some((s) => dayKey(new Date(s.at)) === k)).toBe(false);
    }
    expect(new Set(data.slips.map((s) => s.id)).size).toBe(data.slips.length);
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

  it("leaves the days before today coffee-free and past days near the floor", () => {
    for (let back = 1; back <= 4; back++) {
      const k = dayKey(new Date(2026, 8, 24 - back));
      expect(data.coffee.some((c) => dayKey(new Date(c.at)) === k)).toBe(false);
    }
    const yesterday = entriesForDay(data.water, new Date(2026, 8, 23)).reduce((s, e) => s + e.oz, 0);
    expect(yesterday).toBeGreaterThan(50);
  });
});
