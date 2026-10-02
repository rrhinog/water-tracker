import { describe, expect, it } from "vitest";
import {
  CURVE_HOURS,
  curveFromDays,
  eveningH,
  eveningNeed,
  expectedOz,
  finishBy,
  firstBottleByH,
  hourWhenExpected,
  ozBySameTimeDaysAgo,
  paceStatus,
  paceTickPct,
} from "./pace";

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

describe("paceTickPct", () => {
  it("puts the pace line at the share of the floor expected now, kept on the bar", () => {
    expect(paceTickPct(50, 100)).toBe(50);
    expect(paceTickPct(30, 120)).toBe(25);
    expect(paceTickPct(108, 100)).toBe(100); // history may expect more than the floor
    expect(paceTickPct(0, 100)).toBe(0);
    expect(paceTickPct(10, 0)).toBe(0);
  });
});

describe("finishBy", () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 1, h, m);

  it("gives the time to finish the bottle in hand by to stay on pace", () => {
    // Even, 6 AM-9 PM, 100 oz: the pace first expects more than 36 oz at 11:30 (37 oz).
    expect(finishBy("even", 0, 36, at(7))).toEqual({ kind: "by", h: 11.5 });
    // My history (built-in curve): 40 oz now plus a 36 oz Yeti = 76; the curve passes 76 at 4 PM.
    expect(finishBy("history", 40, 36, at(11))).toEqual({ kind: "by", h: 16 });
  });

  it("follows the floor, the window and the user's own curve", () => {
    expect(finishBy("even", 0, 20, at(9), 80, { startH: 8, endH: 16 })).toEqual({ kind: "by", h: 10.25 });
    const own = [[6, 0], [12, 60], [22, 120]] as const;
    expect(finishBy("history", 0, 30, at(7), 100, undefined, own)).toEqual({ kind: "by", h: 9.25 });
  });

  it("says the bottle clears the floor when it would", () => {
    expect(finishBy("even", 70, 36, at(15))).toEqual({ kind: "clears" });
  });

  it("gives no deadline once the floor is cleared, or when even this bottle now leaves you behind", () => {
    expect(finishBy("even", 100, 36, at(15))).toBeNull();
    expect(finishBy("even", 10, 36, at(20))).toBeNull(); // pace passed 46 oz at 1 PM
  });
});

describe("eveningNeed", () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 1, h, m);

  it("evening is an hour before the window ends", () => {
    expect(eveningH({ startH: 6, endH: 21 })).toBe(20);
    expect(eveningH({ startH: 8, endH: 16 })).toBe(15);
  });

  // Ryan's ruling (2026-10-02): option A, today's real rate. The two worked examples he decided on:
  it("warns when today's rate leaves more than a quarter of the floor for after the evening hour", () => {
    // 2 PM, 40 oz: 5 oz an hour since 6 AM, 70 by 8 PM, so 30 still to go after it.
    expect(eveningNeed(40, at(14))).toEqual({ oz: 30, afterH: 20 });
    // 5 PM, 50 oz: 4.55 oz an hour over 11 hours, 63.6 by 8 PM, so 36.4 still to go after it.
    expect(eveningNeed(50, at(17))).toEqual({ oz: 36, afterH: 20 });
  });

  it("can warn while My history says on pace: that curve is back-loaded itself, and the warning says so", () => {
    expect(paceStatus("history", 40, at(14), at(9)).delta).toBe(0); // on pace at 2 PM
    expect(eveningNeed(40, at(14))).not.toBeNull();
  });

  it("stays quiet on a day that is keeping up", () => {
    expect(eveningNeed(70, at(14))).toBeNull(); // 8.75 oz an hour: past the floor before 8 PM
  });

  it("only between the first-bottle checkpoint and the evening hour, and never after the floor", () => {
    expect(eveningNeed(0, at(9, 45))).toBeNull(); // too early to judge a rate
    expect(eveningNeed(0, at(10))).toEqual({ oz: 100, afterH: 20 });
    expect(eveningNeed(40, at(20))).toBeNull(); // the evening is here: "N oz to the floor" says it
    expect(eveningNeed(100, at(14))).toBeNull();
  });

  it("the quarter is strict, and follows the floor and window", () => {
    // Window 8 AM-6 PM (evening 5 PM), 90 oz floor, at 1 PM: a quarter is 22.5 oz.
    const w = { startH: 8, endH: 18 };
    expect(eveningNeed(37.5, at(13), 90, w)).toBeNull(); // 7.5 oz/h: 67.5 by 5 PM, exactly 22.5 left
    expect(eveningNeed(37, at(13), 90, w)).toEqual({ oz: 23, afterH: 17 }); // 7.4 oz/h: 66.6, 23.4 left
  });
});

describe("ozBySameTimeDaysAgo", () => {
  const now = new Date(2026, 9, 1, 15, 30); // Thu 1 Oct, 3:30 PM
  const on = (d: number, h: number, m: number, oz: number, untimed = false) => ({ at: new Date(2026, 8, d, h, m).toISOString(), oz, untimed });

  it("sums what was logged by the same clock time 7 days ago", () => {
    const entries = [on(24, 9, 0, 36), on(24, 14, 0, 40), on(24, 15, 30, 10), on(24, 18, 0, 36), on(24, 23, 59, 20, true), on(25, 10, 0, 50)];
    expect(ozBySameTimeDaysAgo(entries, now)).toBe(86);
  });

  it("is 0 when that day's drinks all came later, and null when it has none to compare", () => {
    expect(ozBySameTimeDaysAgo([on(24, 18, 0, 36)], now)).toBe(0);
    expect(ozBySameTimeDaysAgo([on(23, 9, 0, 36)], now)).toBeNull();
    expect(ozBySameTimeDaysAgo([on(24, 23, 59, 60, true)], now)).toBeNull(); // backfill has no time
    expect(ozBySameTimeDaysAgo([on(24, 8, 0, 0)], now)).toBeNull(); // only a "Started bottle" marker
  });

  it("keeps the clock time across a daylight-saving change", () => {
    const after = new Date(2026, 10, 4, 15, 30); // Wed 4 Nov, after the US clocks went back on 1 Nov
    const lastWed = { at: new Date(2026, 9, 28, 15, 0).toISOString(), oz: 40 };
    expect(ozBySameTimeDaysAgo([lastWed], after)).toBe(40);
  });
});
