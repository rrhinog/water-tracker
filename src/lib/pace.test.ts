import { describe, expect, it } from "vitest";
import { CURVE_HOURS, curveFromDays, expectedOz, firstBottleByH, hourWhenExpected, paceStatus } from "./pace";

describe("expectedOz", () => {
  it("even mode spreads the floor over the window", () => {
    expect(expectedOz("even", 5)).toBe(0);
    expect(expectedOz("even", 13.5)).toBe(50); // halfway through 6 AM-9 PM
    expect(expectedOz("even", 21)).toBe(100);
    expect(expectedOz("even", 23)).toBe(100);
  });

  it("even mode follows a custom floor and window", () => {
    expect(expectedOz("even", 12, 80, { startH: 8, endH: 16 })).toBe(40);
  });

  it("history mode follows the cleared-day curve and interpolates between points", () => {
    expect(expectedOz("history", 10)).toBe(20);
    expect(expectedOz("history", 12)).toBe(40);
    expect(expectedOz("history", 15)).toBe(60);
    expect(expectedOz("history", 16)).toBe(80);
  });

  it("history mode scales with the floor", () => {
    expect(expectedOz("history", 16, 50)).toBe(40);
  });

  it("history mode is flat until 2 PM and steep after, the shape the data showed", () => {
    expect(expectedOz("history", 14) - expectedOz("history", 12)).toBe(0);
    expect(expectedOz("history", 16) - expectedOz("history", 14)).toBe(40);
  });
});

describe("hourWhenExpected", () => {
  it("finds the next time the pace overtakes the current total", () => {
    expect(hourWhenExpected("even", 0)).toBe(6.25);
    expect(hourWhenExpected("history", 40)).toBe(14.25);
  });
});

describe("paceStatus", () => {
  const at = (h: number, m = 0) => new Date(2026, 8, 22, h, m);

  it("reports behind and a next-due time", () => {
    const s = paceStatus("history", 40, at(16, 30), at(9));
    expect(s.expected).toBe(80);
    expect(s.delta).toBe(-40);
    expect(s.nextDueH).toBeNull();
    expect(s.firstBottleDone).toBe(true);
  });

  it("reports ahead with the next drink due later", () => {
    const s = paceStatus("history", 40, at(11), at(9));
    expect(s.delta).toBe(10);
    expect(s.nextDueH).toBe(14.25);
  });

  it("flags the missed first-bottle checkpoint, which follows the window", () => {
    expect(firstBottleByH({ startH: 6, endH: 21 })).toBe(10);
    expect(firstBottleByH({ startH: 8, endH: 20 })).toBe(12);
    expect(paceStatus("even", 0, at(11), null).firstBottleMissed).toBe(true);
    expect(paceStatus("even", 0, at(9), null).firstBottleMissed).toBe(false);
    expect(paceStatus("even", 36, at(12), at(11)).firstBottleMissed).toBe(true);
    expect(paceStatus("even", 36, at(12), at(11), 100, { startH: 8, endH: 20 }).firstBottleMissed).toBe(false);
  });
});

describe("curveFromDays", () => {
  const profile = (oz: number[]) => ({ cumulative: oz });
  const steady = profile([0, 10, 20, 40, 50, 70, 90, 100, 100]);

  it("returns null until there are enough days", () => {
    expect(curveFromDays(Array(9).fill(steady))).toBeNull();
    expect(curveFromDays(Array(10).fill(steady))).not.toBeNull();
  });

  it("takes the median at each sample hour and drives the history pace unscaled", () => {
    const early = profile([0, 40, 40, 80, 80, 80, 100, 100, 100]);
    const curve = curveFromDays([...Array(5).fill(steady), ...Array(5).fill(early)])!;
    expect(curve.map(([h]) => h)).toEqual([...CURVE_HOURS]);
    expect(curve[1][1]).toBe(25); // median of 10 and 40 at 8 AM
    expect(expectedOz("history", 8, 80, undefined, curve)).toBe(25); // own curve: floor does not rescale it
  });
});
