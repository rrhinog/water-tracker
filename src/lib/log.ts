// Pure logic for the water log. No browser APIs here, so it is unit-testable.
import type { Bottle, Fraction } from "./bottles";

/** Default daily floor; the live value comes from Settings. */
export const DAILY_FLOOR_OZ = 100;

export interface Entry {
  id: string;
  /** ISO timestamp of when the drink was logged. */
  at: string;
  /** A bottle id from Settings, or "other" for a typed amount. Kept as logged even if the bottle is later removed. */
  bottleId: string;
  /** Fraction of the bottle; always 1 for a one-off amount. */
  fraction: Fraction;
  /** Ounces, computed at log time so a later bottle-size change never rewrites history. */
  oz: number;
  /** Backfilled amount with no known time (sits at 23:59 of its day). */
  untimed?: boolean;
}

/** Local calendar day, YYYY-MM-DD. The day rolls over at local midnight. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ouncesFor(bottle: Bottle, fraction: Fraction): number {
  return Math.round(bottle.oz * fraction * 10) / 10;
}

function newId(now: Date): string {
  return `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeEntry(bottle: Bottle, fraction: Fraction, now: Date): Entry {
  return { id: newId(now), at: now.toISOString(), bottleId: bottle.id, fraction, oz: ouncesFor(bottle, fraction) };
}

/** A typed amount that is not one of the bottles (restaurant cup, disposable bottle). */
export function makeCustomEntry(oz: number, now: Date): Entry {
  return { id: newId(now), at: now.toISOString(), bottleId: "other", fraction: 1, oz: Math.round(oz * 10) / 10 };
}

/** Distinct custom amounts, most recent first, capped for the chip row. */
export function recentCustomAmounts(entries: readonly Entry[], limit = 4): number[] {
  const seen: number[] = [];
  for (let i = entries.length - 1; i >= 0 && seen.length < limit; i--) {
    const e = entries[i];
    if (e.bottleId === "other" && !e.untimed && !seen.includes(e.oz)) seen.push(e.oz);
  }
  return seen;
}

export function entriesForDay(entries: readonly Entry[], day: Date): Entry[] {
  const key = dayKey(day);
  return entries.filter((e) => dayKey(new Date(e.at)) === key);
}

export function totalOz(entries: readonly Entry[]): number {
  return Math.round(entries.reduce((sum, e) => sum + e.oz, 0) * 10) / 10;
}
