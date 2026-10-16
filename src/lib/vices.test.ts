import { describe, expect, it } from "vitest";
import {
  bestRun, floorWindow, hitRate, makeSlip, pactStatus, recordStart, runEndingAt, slipDays, slipMonths, slipsByKind,
  slipCounts, stepsSummary, tallyWhere, viceStatus, type Slip,
} from "./vices";

const slip = (vice: string, d: string, hhmm = "20:00", kind?: string): Slip => {
  const [y, m, dd] = d.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return { id: `${vice}-${d}-${hhmm}`, vice, at: new Date(y, m - 1, dd, h, mi).toISOString(), ...(kind ? { kind } : {}) };
};
const day = (d: string, h = 12) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(y, m - 1, dd, h);
};

describe("slip days and the midnight boundary", () => {
  it("a slip counts on the local calendar day it happened", () => {
    const days = slipDays([slip("alcohol", "2026-03-10", "23:59"), slip("alcohol", "2026-03-12", "00:01")], "alcohol");
    expect([...days].sort()).toEqual(["2026-03-10", "2026-03-12"]);
  });

  it("only counts the vice asked for", () => {
    expect(slipDays([slip("alcohol", "2026-03-10"), slip("sweets", "2026-03-11")], "sweets")).toEqual(new Set(["2026-03-11"]));
  });

  it("makeSlip copies the chip and times it now", () => {
    const now = day("2026-03-10", 21);
    const s = makeSlip("alcohol", now, "Beer");
    expect(s).toMatchObject({ vice: "alcohol", at: now.toISOString(), kind: "Beer" });
    expect(makeSlip("alcohol", now).kind).toBeUndefined();
  });
});

describe("hit-rate", () => {
  const miss = new Set(["2026-03-03", "2026-03-05"]);
  it("counts clean days out of the days in the window, both ends included", () => {
    expect(hitRate(miss, "2026-03-01", "2026-03-07")).toEqual({ clean: 5, total: 7 });
  });
  it("an empty or inverted window is 0 of 0", () => {
    expect(hitRate(miss, "2026-03-08", "2026-03-07")).toEqual({ clean: 0, total: 0 });
  });
  it("crosses a month and a daylight-saving change by calendar days", () => {
    expect(hitRate(new Set(), "2026-02-27", "2026-03-09")).toEqual({ clean: 11, total: 11 });
  });
});

describe("runs", () => {
  const miss = new Set(["2026-03-03", "2026-03-05"]);
  it("the run is the clean days ending on the last day, back to the last miss", () => {
    expect(runEndingAt(miss, "2026-03-01", "2026-03-09")).toBe(4); // 6..9
    expect(runEndingAt(miss, "2026-03-01", "2026-03-05")).toBe(0);
  });
  it("never reaches back before the record starts", () => {
    expect(runEndingAt(new Set(), "2026-03-07", "2026-03-09")).toBe(3);
    expect(runEndingAt(new Set(), null, "2026-03-09")).toBe(0);
  });
  it("best run and where it ended", () => {
    expect(bestRun(miss, "2026-03-01", "2026-03-04")).toEqual({ best: 2, bestEnd: "2026-03-02" });
    expect(bestRun(miss, "2026-03-01", "2026-03-10")).toEqual({ best: 5, bestEnd: "2026-03-10" });
    expect(bestRun(miss, null, "2026-03-10")).toEqual({ best: 0, bestEnd: null });
  });
});

describe("record start", () => {
  it("is the clean-since date, else the first slip, else nothing", () => {
    expect(recordStart({ cleanSince: "2026-01-01" }, new Set(["2025-12-01"]))).toBe("2026-01-01");
    expect(recordStart({}, new Set(["2026-02-03", "2026-01-20"]))).toBe("2026-01-20");
    expect(recordStart({}, new Set())).toBeNull();
  });
});

describe("viceStatus (the Today card)", () => {
  const vice = { id: "alcohol", name: "Alcohol", chips: [], cleanSince: "2026-03-01" };
  it("clean X of Y completed days and the run; today is pending", () => {
    const slips = [slip("alcohol", "2026-03-03"), slip("alcohol", "2026-03-10", "08:00")];
    const s = viceStatus(vice, slips, day("2026-03-10", 21));
    expect(s).toEqual({ clean: 8, total: 9, run: 6, todayCount: 1, start: "2026-03-01" });
  });
  it("tomorrow, today's slip is a missed day and the run restarts", () => {
    const s = viceStatus(vice, [slip("alcohol", "2026-03-10", "08:00")], day("2026-03-11"));
    expect(s).toMatchObject({ clean: 9, total: 10, run: 0, todayCount: 0 });
  });
  it("a vice with no start and no slips has nothing to count yet", () => {
    expect(viceStatus({ id: "x", name: "X", chips: [] }, [], day("2026-03-10"))).toEqual({ clean: 0, total: 0, run: 0, todayCount: 0, start: null });
  });
  it("a clean-since date in the future counts nothing yet", () => {
    expect(viceStatus({ ...vice, cleanSince: "2026-04-01" }, [], day("2026-03-10"))).toMatchObject({ clean: 0, total: 0, run: 0 });
  });
});

describe("pactStatus", () => {
  const pact = { name: "Pact", start: "2026-03-01", days: 10, quits: ["alcohol", "coffee"] };
  const misses = new Map([
    ["alcohol", new Set(["2026-03-02", "2026-02-20"])],
    ["coffee", new Set(["2026-03-04", "2026-03-02"])],
  ]);

  it("combined clean day: no slip for any covered quit; per-quit rates underneath", () => {
    const s = pactStatus(pact, misses, "2026-03-07");
    expect(s.phase).toBe("running");
    expect(s.day).toBe(7);
    expect(s.combined).toEqual({ clean: 4, total: 6 }); // 1..6, misses on 2 and 4
    expect(s.run).toBe(2); // 5, 6
    expect(s.quits).toEqual([
      { id: "alcohol", clean: 5, total: 6 },
      { id: "coffee", clean: 4, total: 6 },
    ]);
  });

  it("Day 1 is all pending: 0 of 0", () => {
    const s = pactStatus(pact, misses, "2026-03-01");
    expect(s).toMatchObject({ phase: "running", day: 1, combined: { clean: 0, total: 0 }, run: 0 });
  });

  it("before Day 1 it is upcoming; after the last day it is done and stops counting", () => {
    expect(pactStatus(pact, misses, "2026-02-25")).toMatchObject({ phase: "upcoming", day: 0, combined: { clean: 0, total: 0 } });
    const done = pactStatus(pact, new Map([["alcohol", new Set(["2026-03-11"])]]), "2026-03-20");
    expect(done).toMatchObject({ phase: "done", day: 10, end: "2026-03-10", combined: { clean: 10, total: 10 }, run: 10 });
  });

  it("a quit with no record is fully clean", () => {
    const s = pactStatus({ ...pact, quits: ["tobacco"] }, new Map(), "2026-03-04");
    expect(s.quits).toEqual([{ id: "tobacco", clean: 3, total: 3 }]);
  });
});

describe("floors", () => {
  it("the window is the Pact's completed days, else the last 30", () => {
    expect(floorWindow({ name: "P", start: "2026-03-01", days: 100, quits: [] }, "2026-03-05")).toEqual({ start: "2026-03-01", last: "2026-03-04" });
    expect(floorWindow({ name: "P", start: "2026-03-01", days: 3, quits: [] }, "2026-03-05")).toEqual({ start: "2026-03-01", last: "2026-03-03" });
    expect(floorWindow(null, "2026-03-31")).toEqual({ start: "2026-03-01", last: "2026-03-30" });
  });

  it("water: days the floor was met, out of the window's days", () => {
    const cleared = new Set(["2026-03-01", "2026-03-03"]);
    expect(tallyWhere({ start: "2026-03-01", last: "2026-03-04" }, (k) => cleared.has(k))).toEqual({ clean: 2, total: 4 });
  });

  it("steps: today's count, as of its sync, and the hit-rate against the floor", () => {
    const rows = [
      { day: "2026-03-01", steps: 12000, syncedAt: "2026-03-02T05:00:00.000Z" },
      { day: "2026-03-02", steps: 4000, syncedAt: "2026-03-03T05:00:00.000Z" },
      { day: "2026-03-04", steps: 8412, syncedAt: "2026-03-04T17:00:00.000Z" },
    ];
    const s = stepsSummary(rows, 10000, { start: "2026-03-01", last: "2026-03-03" }, "2026-03-04");
    expect(s.today).toEqual(rows[2]);
    expect(s.asOf).toBe("2026-03-04T17:00:00.000Z");
    expect(s.tally).toEqual({ clean: 1, total: 3 }); // a day with no row is a miss
    expect(stepsSummary([], 10000, { start: "2026-03-01", last: "2026-03-03" }, "2026-03-04")).toMatchObject({ today: null, asOf: null });
  });
});

describe("history helpers", () => {
  const slips = [
    slip("alcohol", "2026-02-27", "20:00", "Beer"),
    slip("alcohol", "2026-03-02", "20:00", "Wine"),
    slip("alcohol", "2026-03-02", "22:00", "Beer"),
    { ...slip("alcohol", "2026-03-04", "12:00"), fromNotes: true },
  ];
  it("by month: slips and slip days to today, clean days to yesterday (today is pending)", () => {
    expect(slipMonths(slips, "2026-02-26", "2026-03-05")).toEqual([
      { month: "2026-03", slips: 3, slipDays: 2, cleanDays: 2 },
      { month: "2026-02", slips: 1, slipDays: 1, cleanDays: 2 },
    ]);
  });
  it("by kind, most first; no chip reads as unspecified or from notes", () => {
    expect(slipsByKind(slips)).toEqual([
      { kind: "Beer", count: 2 },
      { kind: "Wine", count: 1 },
      { kind: "unknown (from notes)", count: 1 },
    ]);
  });
  it("this week (from Monday) and this month", () => {
    expect(slipCounts(slips, day("2026-03-05"))).toEqual({ thisWeek: 3, thisMonth: 3 });
  });
});
