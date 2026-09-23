import { describe, expect, it } from "vitest";
import { coffeeHistory, coffeeMonths, coffeeStatus, coffeesByFlavour, finishCoffee, formatMinutes, isOpen, lastFlavour, makeCoffee, sipWindow } from "./coffee";

const seed = ["2026-09-15", "2026-09-16", "2026-09-17"].map((d) => ({ id: `seed-coffee-${d}`, at: `${d}T12:00:00`, fromNotes: true }));
const at = (d: number, h = 9) => new Date(2026, 8, d, h);

describe("coffeeStatus", () => {
  it("counts consecutive coffee-free days ending yesterday, from the seed", () => {
    const s = coffeeStatus(seed, at(22));
    expect(s.streak).toBe(4); // 18, 19, 20, 21
    expect(s.todayCount).toBe(0);
    expect(s.lastCoffeeDay).toBe("2026-09-17");
  });

  it("a coffee today resets nothing until tomorrow, but shows today's count", () => {
    const s = coffeeStatus([...seed, makeCoffee(at(22, 7))], at(22, 12));
    expect(s.streak).toBe(4);
    expect(s.todayCount).toBe(1);
    expect(s.lastCoffeeDay).toBe("2026-09-22");
  });

  it("tomorrow, that coffee makes the streak zero", () => {
    const s = coffeeStatus([...seed, makeCoffee(at(22, 7))], at(23));
    expect(s.streak).toBe(0);
  });

});

describe("coffee history", () => {
  const c = (d: string, h = 8) => ({ id: `c-${d}-${h}`, at: `${d}T${String(h).padStart(2, "0")}:00:00` });

  it("finds the best coffee-free run and recent counts", () => {
    const entries = [c("2026-09-01"), c("2026-09-02"), c("2026-09-02", 14), c("2026-09-10"), c("2026-09-21")];
    const h = coffeeHistory(entries, new Date(2026, 8, 22));
    expect(h.bestStreak).toBe(10); // Sep 11-20
    expect(h.bestStreakEnd).toBe("2026-09-20");
    expect(h.thisWeek).toBe(1); // week of Mon Sep 21
    expect(h.thisMonth).toBe(5);
  });

  it("tallies coffees and free days per month", () => {
    const entries = [c("2026-08-30"), c("2026-09-02"), c("2026-09-02", 14)];
    const months = coffeeMonths(entries, new Date(2026, 8, 5));
    expect(months).toEqual([
      { month: "2026-08", coffees: 1, coffeeDays: 1, freeDays: 1 },
      { month: "2026-09", coffees: 2, coffeeDays: 1, freeDays: 4 },
    ]);
  });
});

describe("brew timer", () => {
  const start = new Date(2026, 8, 22, 7, 5);
  it("is open until finished, then reports the sip window", () => {
    const c = makeCoffee(start);
    expect(isOpen(c, new Date(2026, 8, 22, 9, 0))).toBe(true);
    expect(sipWindow(c, new Date(2026, 8, 22, 9, 0))).toBeNull();
    const done = finishCoffee(c, new Date(2026, 8, 22, 10, 0));
    expect(isOpen(done, new Date(2026, 8, 22, 11, 0))).toBe(false);
    expect(sipWindow(done, new Date(2026, 8, 22, 11, 0))).toEqual({ minutes: 175, assumed: false });
    expect(formatMinutes(175)).toBe("2h 55m");
    expect(formatMinutes(48)).toBe("48m");
  });

  it("assumes a forgotten coffee finished after 12 hours", () => {
    const c = makeCoffee(start);
    const later = new Date(2026, 8, 22, 21, 0);
    expect(isOpen(c, later)).toBe(false);
    expect(sipWindow(c, later)).toEqual({ minutes: 720, assumed: true });
  });

  it("imported note days have no window", () => {
    expect(sipWindow({ id: "n", at: "2026-09-01T12:00:00", fromNotes: true }, new Date(2026, 8, 22))).toBeNull();
  });
});

describe("flavours", () => {
  it("counts by flavour and remembers the last one", () => {
    const t = (h: number) => new Date(2026, 8, 22, h);
    const entries = [
      { id: "n1", at: "2026-09-01T12:00:00", fromNotes: true },
      makeCoffee(t(7), "BRCC Spirit of '76"),
      makeCoffee(t(9), "Starbucks Vanilla"),
      makeCoffee(t(11), "BRCC Spirit of '76"),
      makeCoffee(t(13)),
    ];
    expect(coffeesByFlavour(entries)).toEqual([
      { flavour: "BRCC Spirit of '76", count: 2 },
      { flavour: "unknown (from notes)", count: 1 },
      { flavour: "Starbucks Vanilla", count: 1 },
      { flavour: "unspecified", count: 1 },
    ]);
    expect(lastFlavour(entries)).toBe("BRCC Spirit of '76");
    expect(lastFlavour([])).toBeNull();
  });
});
