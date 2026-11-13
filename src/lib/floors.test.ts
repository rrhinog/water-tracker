import { describe, expect, it } from "vitest";
import { floorWindow, hitRate, stepsSummary, tallyWhere } from "./floors";

describe("hit-rate", () => {
  const miss = new Set(["2026-03-03", "2026-03-05"]);
  it("counts days met out of the days in the window, both ends included", () => {
    expect(hitRate(miss, "2026-03-01", "2026-03-07")).toEqual({ clean: 5, total: 7 });
  });
  it("an empty or inverted window is 0 of 0", () => {
    expect(hitRate(miss, "2026-03-08", "2026-03-07")).toEqual({ clean: 0, total: 0 });
  });
  it("crosses a month and a daylight-saving change by calendar days", () => {
    expect(hitRate(new Set(), "2026-02-27", "2026-03-09")).toEqual({ clean: 11, total: 11 });
  });
});

describe("floors", () => {
  it("the window runs from the count-from date to yesterday, else the last 30 days", () => {
    expect(floorWindow("2026-03-01", "2026-03-05")).toEqual({ start: "2026-03-01", last: "2026-03-04" });
    expect(floorWindow(null, "2026-03-31")).toEqual({ start: "2026-03-01", last: "2026-03-30" });
  });

  it("keeps counting past what used to be a fixed end: the window has no end but yesterday", () => {
    expect(floorWindow("2026-03-01", "2026-07-01")).toEqual({ start: "2026-03-01", last: "2026-06-30" });
  });

  it("a count-from date of today or later is an empty window, 0 of 0, until that day is over", () => {
    const w = floorWindow("2026-03-05", "2026-03-05");
    expect(tallyWhere(w, () => true)).toEqual({ clean: 0, total: 0 });
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
    expect(s.tally).toEqual({ clean: 1, total: 2 }); // Mar 3 has no row: no data, not a miss
    expect(s.noData).toBe(1);
    expect(stepsSummary([], 10000, { start: "2026-03-01", last: "2026-03-03" }, "2026-03-04")).toEqual({ today: null, asOf: null, tally: { clean: 0, total: 0 }, noData: 3 });
  });
});
