// The Floors: how often the water floor (and, with a steps source, the steps floor) was met.
// Pure functions, no browser APIs.
//
// Days are local calendar days (dayKey), the same boundary the rest of the app uses. Today is pending
// in every hit-rate until it is over, so a window always ends yesterday.
import { addDays } from "./history";

export interface Tally {
  clean: number;
  total: number;
}

/** Days met out of the days from `start` to `last`, both included; `miss` holds the days not met. 0 of 0 when the window is empty. */
export function hitRate(miss: ReadonlySet<string>, start: string, last: string): Tally {
  let clean = 0, total = 0;
  for (let k = start; k <= last; k = addDays(k, 1)) {
    total++;
    if (!miss.has(k)) clean++;
  }
  return { clean, total };
}

/** How many days the Floors look back when no "count from" date is set. */
export const FLOORS_DEFAULT_DAYS = 30;

/**
 * The days the Floors are scored over: from the "count from" date (Settings) to yesterday, or the last
 * 30 days without one. A date after yesterday gives an empty window (0 of 0) until that day is over.
 */
export function floorWindow(from: string | null, today: string): { start: string; last: string } {
  const yesterday = addDays(today, -1);
  return { start: from ?? addDays(today, -FLOORS_DEFAULT_DAYS), last: yesterday };
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
  /** Days in the window with no row: no data, neither met nor missed. */
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
