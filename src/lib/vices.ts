// Vices (things to quit), the Pact that scores them together, and the Floors beside it.
// Target is zero, so the metric is clean days: days WITHOUT a slip. Pure functions, no browser APIs.
//
// Days are local calendar days (dayKey), so a slip at 23:59 counts on its own day and one at 00:01 on
// the next, the same boundary water and coffee use. Today is pending in every hit-rate until it is
// over; a run counts up to yesterday, but a slip today ends it at once (the run reads 0). Coffee is not a slip; its days come in through coffeeDays() as one more set of
// missed days, so these functions never need to know which quit a set belongs to.
import { addDays } from "./history";
import { dayKey } from "./log";
import type { Pact, Vice } from "./settings";

export interface Slip {
  id: string;
  /** A vice id from Settings (e.g. "alcohol"). Kept as logged even if the vice is later removed. */
  vice: string;
  /** ISO timestamp of when it happened. */
  at: string;
  /** The chip picked ("Beer"), copied at log time like coffee's flavour. */
  kind?: string;
  /** Imported from a notes file: the day is known, the time is not (set to noon). */
  fromNotes?: boolean;
}

/** Enough of a Settings vice for the counting here. */
export interface ViceLike {
  cleanSince?: string;
}

/** The Pact's id for coffee, next to the vice ids. Settings refuses a vice with this id. */
export const COFFEE_QUIT = "coffee";

export interface Tally {
  clean: number;
  total: number;
}

export function makeSlip(vice: string, at: Date, kind?: string): Slip {
  const s: Slip = { id: `${at.getTime()}-${Math.random().toString(36).slice(2, 8)}`, vice, at: at.toISOString() };
  if (kind) s.kind = kind;
  return s;
}

/** Every day with at least one slip for this vice. */
export function slipDays(slips: readonly Slip[], vice: string): Set<string> {
  const days = new Set<string>();
  for (const s of slips) if (s.vice === vice) days.add(dayKey(new Date(s.at)));
  return days;
}

/** Clean days out of the days from `start` to `last`, both included. 0 of 0 when the window is empty. */
export function hitRate(miss: ReadonlySet<string>, start: string, last: string): Tally {
  let clean = 0, total = 0;
  for (let k = start; k <= last; k = addDays(k, 1)) {
    total++;
    if (!miss.has(k)) clean++;
  }
  return { clean, total };
}

/** Consecutive clean days ending on `last`, never reaching back before `start`. 0 with no start. */
export function runEndingAt(miss: ReadonlySet<string>, start: string | null, last: string): number {
  if (!start) return 0;
  let run = 0;
  for (let k = last; k >= start && !miss.has(k); k = addDays(k, -1)) run++;
  return run;
}

/** The longest clean run between `start` and `last`, and the day it ended. */
export function bestRun(miss: ReadonlySet<string>, start: string | null, last: string): { best: number; bestEnd: string | null } {
  let best = 0, bestEnd: string | null = null, run = 0;
  if (!start) return { best, bestEnd };
  for (let k = start; k <= last; k = addDays(k, 1)) {
    run = miss.has(k) ? 0 : run + 1;
    if (run > best) { best = run; bestEnd = k; }
  }
  return { best, bestEnd };
}

/** Where a vice's record starts: its clean-since date, else its first slip, else nowhere yet. */
export function recordStart(vice: ViceLike, miss: ReadonlySet<string>): string | null {
  if (vice.cleanSince) return vice.cleanSince;
  let first: string | null = null;
  for (const k of miss) if (first === null || k < first) first = k;
  return first;
}

export interface ViceStatus extends Tally {
  /** Clean days in a row, ending yesterday; 0 as soon as today has a slip. */
  run: number;
  todayCount: number;
  start: string | null;
}

/** The Today card: clean X of Y completed days since the record started, the current run, and today's slips. */
export function viceStatus(vice: Vice, slips: readonly Slip[], now: Date): ViceStatus {
  const miss = slipDays(slips, vice.id);
  const today = dayKey(now);
  const yesterday = addDays(today, -1);
  const start = recordStart(vice, miss);
  const tally = start ? hitRate(miss, start, yesterday) : { clean: 0, total: 0 };
  return {
    ...tally,
    run: miss.has(today) ? 0 : runEndingAt(miss, start, yesterday),
    todayCount: slips.filter((s) => s.vice === vice.id && dayKey(new Date(s.at)) === today).length,
    start,
  };
}

export interface PactStatus {
  phase: "upcoming" | "running" | "done";
  /** Today's day number, 1-based: 0 before Day 1, the length once it is over. */
  day: number;
  /** The last day of the Pact. */
  end: string;
  /** Days with no slip for ANY covered quit, over the completed days so far. */
  combined: Tally;
  /** Combined clean days in a row, ending on the last completed day; 0 as soon as any covered quit has a slip today. */
  run: number;
  /** Each quit's own hit-rate over the same days, in the Pact's order. */
  quits: (Tally & { id: string })[];
}

/** Days from a to b (b − a), by calendar day. */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** The Pact, scored over its completed days. `miss` maps a quit id (a vice, or "coffee") to its missed days. */
export function pactStatus(pact: Pact, miss: ReadonlyMap<string, ReadonlySet<string>>, today: string): PactStatus {
  const end = addDays(pact.start, pact.days - 1);
  const yesterday = addDays(today, -1);
  const last = yesterday < end ? yesterday : end;
  const combinedMiss = new Set<string>();
  for (const q of pact.quits) for (const k of miss.get(q) ?? []) combinedMiss.add(k);
  const phase = today < pact.start ? "upcoming" : today > end ? "done" : "running";
  return {
    phase,
    day: phase === "upcoming" ? 0 : phase === "done" ? pact.days : daysBetween(pact.start, today) + 1,
    end,
    combined: hitRate(combinedMiss, pact.start, last),
    run: phase === "running" && combinedMiss.has(today) ? 0 : runEndingAt(combinedMiss, pact.start, last),
    quits: pact.quits.map((id) => ({ id, ...hitRate(miss.get(id) ?? new Set(), pact.start, last) })),
  };
}

/** The days the Floors are scored over: the Pact's completed days, or the last 30 without a Pact. */
export function floorWindow(pact: Pact | null, today: string): { start: string; last: string } {
  const yesterday = addDays(today, -1);
  if (!pact) return { start: addDays(today, -30), last: yesterday };
  const end = addDays(pact.start, pact.days - 1);
  return { start: pact.start, last: yesterday < end ? yesterday : end };
}

/** Days in a window that pass a test (a Floor met), out of the days in it. */
export function tallyWhere(window: { start: string; last: string }, hit: (day: string) => boolean): Tally {
  const miss = new Set<string>();
  for (let k = window.start; k <= window.last; k = addDays(k, 1)) if (!hit(k)) miss.add(k);
  return hitRate(miss, window.start, window.last);
}

export interface StepsDay {
  /** YYYY-MM-DD */
  day: string;
  steps: number;
  /** ISO timestamp of the sync that wrote this row. */
  syncedAt: string;
}

export interface StepsSummary {
  today: StepsDay | null;
  /** When the newest row was synced: what the card shows as "as of", never "now". */
  asOf: string | null;
  /** Days with a row that reached the floor, out of the days with a row. */
  tally: Tally;
  /** Days in the window with no row: no data, neither clean nor missed. */
  noData: number;
}

export function stepsSummary(rows: readonly StepsDay[], floor: number, window: { start: string; last: string }, today: string): StepsSummary {
  const by = new Map(rows.map((r) => [r.day, r]));
  let clean = 0, total = 0, noData = 0;
  for (let k = window.start; k <= window.last; k = addDays(k, 1)) {
    const row = by.get(k);
    if (!row) { noData++; continue; }
    total++;
    if (row.steps >= floor) clean++;
  }
  let asOf: string | null = null;
  for (const r of rows) if (asOf === null || r.syncedAt > asOf) asOf = r.syncedAt;
  return { today: by.get(today) ?? null, asOf, tally: { clean, total }, noData };
}

export interface SlipMonth { month: string; slips: number; slipDays: number; cleanDays: number }

/** Per month, newest first, from the record start: slips and slip days up to today, clean days up to yesterday. */
export function slipMonths(slips: readonly Slip[], start: string | null, today: string): SlipMonth[] {
  if (!start) return [];
  const by = new Map<string, number>();
  for (const s of slips) {
    const k = dayKey(new Date(s.at));
    by.set(k, (by.get(k) ?? 0) + 1);
  }
  const out = new Map<string, SlipMonth>();
  for (let k = start; k <= today; k = addDays(k, 1)) {
    const mo = k.slice(0, 7);
    const row = out.get(mo) ?? { month: mo, slips: 0, slipDays: 0, cleanDays: 0 };
    const n = by.get(k) ?? 0;
    row.slips += n;
    if (n > 0) row.slipDays++;
    else if (k < today) row.cleanDays++;
    out.set(mo, row);
  }
  return [...out.values()].reverse();
}

/** Slips per chip, most first. A slip with no chip reads as "unspecified" (or "unknown (from notes)"). */
export function slipsByKind(slips: readonly Slip[]): { kind: string; count: number }[] {
  const m = new Map<string, number>();
  for (const s of slips) {
    const k = s.kind ?? (s.fromNotes ? "unknown (from notes)" : "unspecified");
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count);
}

/** Slips this week (Monday-based) and this month, today's included. */
export function slipCounts(slips: readonly Slip[], now: Date): { thisWeek: number; thisMonth: number } {
  const today = dayKey(now);
  const weekStart = addDays(today, 1 - (now.getDay() || 7));
  const monthStart = `${today.slice(0, 7)}-01`;
  let thisWeek = 0, thisMonth = 0;
  for (const s of slips) {
    const k = dayKey(new Date(s.at));
    if (k > today) continue;
    if (k >= weekStart) thisWeek++;
    if (k >= monthStart) thisMonth++;
  }
  return { thisWeek, thisMonth };
}
