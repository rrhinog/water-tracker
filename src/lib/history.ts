// History + analytics over the bundled backfill and what the app has logged since.
// Pure functions, no browser APIs.
import { DAILY_FLOOR_OZ, dayKey, type Entry } from "./log";
import { CURVE_HOURS, formatHour, type DayProfile } from "./pace";

export interface DaySummary {
  day: string;
  totalOz: number;
  cleared: boolean;
  /** Local hour of the first timed drink, or null if unknown. */
  firstHour: number | null;
}

/** ISO day -> summary over every entry (backfilled rows included). */
export function buildDays(entries: readonly Entry[], floorOz: number = DAILY_FLOOR_OZ): Map<string, DaySummary> {
  const byDay = new Map<string, Entry[]>();
  for (const e of entries) {
    const k = dayKey(new Date(e.at));
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const days = new Map<string, DaySummary>();
  for (const [k, list] of byDay) {
    const total = Math.round(list.reduce((a, e) => a + e.oz, 0) * 10) / 10;
    const timed = list.filter((e) => !e.untimed);
    const first = timed.length ? timed.reduce((a, e) => (e.at < a ? e.at : a), timed[0].at) : null;
    days.set(k, { day: k, totalOz: total, cleared: total >= floorOz, firstHour: first ? hourOfIso(first) : null });
  }
  return days;
}

function hourOfIso(iso: string): number {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

/** Last `n` days ending at `today`, oldest first; days with no data have totalOz 0 and cleared false. */
export function lastNDays(days: Map<string, DaySummary>, today: string, n: number): DaySummary[] {
  const out: DaySummary[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const k = addDays(today, -i);
    out.push(days.get(k) ?? { day: k, totalOz: 0, cleared: false, firstHour: null });
  }
  return out;
}

export interface Streaks {
  /** Consecutive cleared days ending yesterday (or today if today is already cleared). */
  current: number;
  best: number;
  bestEnd: string | null;
}

export function streaks(days: Map<string, DaySummary>, today: string): Streaks {
  const keys = [...days.keys()].sort();
  let best = 0, bestEnd: string | null = null, run = 0;
  let prev: string | null = null;
  for (const k of keys) {
    const d = days.get(k)!;
    run = d.cleared && prev !== null && addDays(prev, 1) === k ? run + 1 : d.cleared ? 1 : 0;
    if (run > best) { best = run; bestEnd = k; }
    prev = k;
  }
  let current = 0;
  let k = days.get(today)?.cleared ? today : addDays(today, -1);
  while (days.get(k)?.cleared) { current++; k = addDays(k, -1); }
  return { current, best, bestEnd };
}

export type Period = "week" | "month" | "quarter";

export interface PeriodStat { key: string; label: string; days: number; avgOz: number; cleared: number }

/** ISO week key (weeks start Monday), e.g. "2026-W38". */
export function isoWeekKey(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay() || 7; // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - dow); // Thursday of this week decides the year
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** The Monday that starts the ISO week containing `day`. */
export function weekStart(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay() || 7;
  return addDays(day, 1 - dow);
}

export function periodKey(day: string, period: Period): string {
  if (period === "week") return isoWeekKey(day);
  if (period === "month") return day.slice(0, 7);
  const [y, m] = day.split("-").map(Number);
  return `${y}-Q${Math.ceil(m / 3)}`;
}

export function periodStats(days: Map<string, DaySummary>, period: Period): PeriodStat[] {
  const acc = new Map<string, { n: number; sum: number; cleared: number; first: string }>();
  for (const d of days.values()) {
    const k = periodKey(d.day, period);
    const a = acc.get(k) ?? { n: 0, sum: 0, cleared: 0, first: d.day };
    a.n++; a.sum += d.totalOz; a.cleared += d.cleared ? 1 : 0;
    if (d.day < a.first) a.first = d.day;
    acc.set(k, a);
  }
  return [...acc].sort().map(([key, a]) => ({
    key,
    label: period === "week" ? `wk of ${weekStart(a.first).slice(5)}` : key,
    days: a.n,
    avgOz: Math.round(a.sum / a.n),
    cleared: a.cleared,
  }));
}

/** Kept for callers that want months specifically. */
export function monthlyStats(days: Map<string, DaySummary>): PeriodStat[] {
  return periodStats(days, "month");
}

export interface Bar { label: string; oz: number; cleared: boolean; isToday: boolean; days: number }

/** Bars for the chart: daily for week/month, weekly averages for quarter. */
export function chartBars(days: Map<string, DaySummary>, today: string, period: Period, floorOz: number = DAILY_FLOOR_OZ): Bar[] {
  if (period !== "quarter") {
    const n = period === "week" ? 7 : 30;
    return lastNDays(days, today, n).map((d) => {
      const [y, m, dd] = d.day.split("-").map(Number);
      const dt = new Date(y, m - 1, dd);
      return { label: period === "week" ? dt.toLocaleDateString([], { weekday: "short" }) : String(dd), oz: d.totalOz, cleared: d.cleared, isToday: d.day === today, days: 1 };
    });
  }
  const out: Bar[] = [];
  const thisMonday = weekStart(today);
  for (let w = 12; w >= 0; w--) {
    const start = addDays(thisMonday, -7 * w);
    const week = Array.from({ length: 7 }, (_, i) => days.get(addDays(start, i))).filter((d): d is DaySummary => !!d && d.day <= today);
    const avg = week.length ? Math.round(week.reduce((a, d) => a + d.totalOz, 0) / week.length) : 0;
    out.push({ label: start.slice(5), oz: avg, cleared: avg >= floorOz, isToday: w === 0, days: week.length });
  }
  return out;
}

export interface FirstBottleBucket { label: string; days: number; clearPct: number; avgOz: number }

/** The discovery table: does the time of the first drink predict clearing the floor? */
export function firstBottleTable(days: Map<string, DaySummary>, byH = 10): FirstBottleBucket[] {
  const timed = [...days.values()].filter((d) => d.firstHour !== null);
  const bucket = (label: string, pred: (h: number) => boolean): FirstBottleBucket => {
    const set = timed.filter((d) => pred(d.firstHour!));
    const n = set.length;
    return {
      label,
      days: n,
      clearPct: n ? Math.round((set.filter((d) => d.cleared).length / n) * 100) : 0,
      avgOz: n ? Math.round(set.reduce((a, d) => a + d.totalOz, 0) / n) : 0,
    };
  };
  return [
    bucket(`by ${formatHour(byH)}`, (h) => h <= byH),
    bucket(`${formatHour(byH)} - ${formatHour(byH + 2)}`, (h) => h > byH && h <= byH + 2),
    bucket(`after ${formatHour(byH + 2)}`, (h) => h > byH + 2),
  ];
}

/** Calendar cells for a month: 'cleared' | 'missed' | 'none'. */
export function monthCells(days: Map<string, DaySummary>, month: string): { day: string; state: "cleared" | "missed" | "none"; totalOz: number }[] {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => {
    const k = `${month}-${String(i + 1).padStart(2, "0")}`;
    const d = days.get(k);
    return { day: k, state: d ? (d.cleared ? "cleared" : "missed") : "none", totalOz: d?.totalOz ?? 0 };
  });
}

/**
 * Cumulative-by-hour profiles for days that cleared the floor and whose drinks are all timed
 * (a totals-only backfill day contributes nothing).
 */
export function clearedDayProfiles(entries: readonly Entry[], floorOz: number): DayProfile[] {
  const byDay = new Map<string, Entry[]>();
  for (const e of entries) {
    const k = dayKey(new Date(e.at));
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const out: DayProfile[] = [];
  for (const list of byDay.values()) {
    const total = list.reduce((a, e) => a + e.oz, 0);
    if (total < floorOz || list.some((e) => e.untimed)) continue;
    const cumulative = CURVE_HOURS.map((h) =>
      Math.round(list.filter((e) => hourOfIso(e.at) <= h).reduce((a, e) => a + e.oz, 0) * 10) / 10,
    );
    out.push({ cumulative });
  }
  return out;
}
