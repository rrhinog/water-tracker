import { describe, expect, it } from "vitest";
import { buildDays, chartBars, clearedDayProfiles, firstBottleTable, isoWeekKey, lastNDays, monthCells, monthlyStats, periodStats, streaks, weekStart } from "./history";
import { makeEntry, type Entry } from "./log";
import { DEFAULT_SETTINGS } from "./settings";

const [, yeti, camelbak] = DEFAULT_SETTINGS.bottles;

// Four backfilled days, shaped like rows the import creates.
const row = (id: string, at: string, oz: number, untimed = false): Entry => ({ id, at, bottleId: "owala", fraction: 1, oz, untimed });
const seed: Entry[] = [
  row("s1", "2026-09-10T06:30:00", 100),
  row("s2", "2026-09-11T08:16:00", 120),
  row("s3", "2026-09-12T13:28:00", 40),
  row("s4", "2026-09-13T23:59:00", 90, true),
];

describe("buildDays", () => {
  it("sums a day's entries and finds the first timed drink", () => {
    const app = [makeEntry(yeti, 1, new Date(2026, 8, 14, 9, 0)), makeEntry(yeti, 1, new Date(2026, 8, 14, 15, 0))];
    const days = buildDays([...seed, ...app]);
    expect(days.get("2026-09-11")?.cleared).toBe(true);
    expect(days.get("2026-09-14")?.totalOz).toBe(72);
    expect(days.get("2026-09-14")?.firstHour).toBe(9);
  });

  it("ignores untimed backfill rows when deciding the first hour", () => {
    expect(buildDays(seed).get("2026-09-13")?.firstHour).toBeNull();
    expect(buildDays(seed).get("2026-09-13")?.totalOz).toBe(90);
  });
});

describe("streaks", () => {
  it("counts the current run ending yesterday and the best run overall", () => {
    const s = streaks(buildDays(seed), "2026-09-14");
    expect(s.best).toBe(2);
    expect(s.bestEnd).toBe("2026-09-11");
    expect(s.current).toBe(0); // 13th missed
  });

  it("includes today when today is already cleared", () => {
    const app = [makeEntry(camelbak, 1, new Date(2026, 8, 14, 8)), makeEntry(camelbak, 1, new Date(2026, 8, 14, 12))];
    const seed2 = seed.map((d) => (d.id === "s4" ? { ...d, oz: 110 } : d));
    expect(streaks(buildDays([...seed2, ...app]), "2026-09-14").current).toBe(2);
  });
});

describe("tables", () => {
  it("lastNDays fills gaps with zero days", () => {
    const week = lastNDays(buildDays(seed), "2026-09-14", 7);
    expect(week).toHaveLength(7);
    expect(week[0].day).toBe("2026-09-08");
    expect(week[0].totalOz).toBe(0);
    expect(week[6].day).toBe("2026-09-14");
  });

  it("monthlyStats averages and counts cleared days", () => {
    const [sep] = monthlyStats(buildDays(seed));
    expect(sep).toMatchObject({ key: "2026-09", days: 4, avgOz: 88, cleared: 2 });
  });

  it("ISO weeks start on Monday", () => {
    expect(isoWeekKey("2026-09-21")).toBe("2026-W39"); // a Monday
    expect(isoWeekKey("2026-09-20")).toBe("2026-W38"); // the Sunday before
    expect(weekStart("2026-09-22")).toBe("2026-09-21");
    expect(weekStart("2026-09-20")).toBe("2026-09-14");
  });

  it("periodStats buckets by week and quarter", () => {
    const d = buildDays(seed);
    expect(periodStats(d, "week").map((p) => p.key)).toEqual(["2026-W37"]) // Sep 10-13 are Thu-Sun of ISO week 37;
    expect(periodStats(d, "quarter")[0]).toMatchObject({ key: "2026-Q3", days: 4, avgOz: 88 });
  });

  it("chartBars gives 7 daily bars for week, 30 for month, 13 weekly averages for quarter", () => {
    const d = buildDays(seed);
    expect(chartBars(d, "2026-09-14", "week")).toHaveLength(7);
    expect(chartBars(d, "2026-09-14", "month")).toHaveLength(30);
    const q = chartBars(d, "2026-09-14", "quarter");
    expect(q).toHaveLength(13);
    expect(q[12].isToday).toBe(true);
    expect(q[11].oz).toBe(88); // week of 09-07..13 holds all four seed days
  });

  it("firstBottleTable buckets by first timed drink", () => {
    const t = firstBottleTable(buildDays(seed));
    expect(t[0]).toMatchObject({ days: 2, clearPct: 100, avgOz: 110 });
    expect(t[2].days).toBe(1);
  });

  it("monthCells marks cleared / missed / none", () => {
    const cells = monthCells(buildDays(seed), "2026-09");
    expect(cells).toHaveLength(30);
    expect(cells[9].state).toBe("cleared");
    expect(cells[11].state).toBe("missed");
    expect(cells[0].state).toBe("none");
  });
});


describe("clearedDayProfiles", () => {
  it("profiles only cleared days whose drinks are all timed", () => {
    const d = (day: number, h: number, oz: number) => ({ ...makeEntry(camelbak, 1, new Date(2026, 8, day, h)), oz });
    const entries = [
      d(1, 8, 50), d(1, 14, 50), // cleared, timed
      d(2, 8, 50), // missed
      d(3, 9, 60), { ...d(3, 23, 50), untimed: true }, // cleared but partly untimed
    ];
    const p = clearedDayProfiles(entries, 100);
    expect(p).toHaveLength(1);
    expect(p[0].cumulative).toEqual([0, 50, 50, 50, 100, 100, 100, 100, 100]);
  });
});
