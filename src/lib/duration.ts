// How long a bottle takes to drink. Pure functions, no browser APIs.
//
// A finished drink is logged when the bottle is empty, so the time between two finishes is the
// time the second bottle took. The first bottle of the day has no earlier finish, so the user may
// tap "Started bottle" once; that start is stored as its own zero-ounce row and never changes totals.
import { dayKey, type Entry } from "./log";

/** The bottleId of a start marker row (oz 0). Not a bottle in Settings. */
export const STARTED = "started";

export function isStart(e: Entry): boolean {
  return e.bottleId === STARTED;
}

/** Entries that are actual drinks (start markers removed). */
export function drinks(entries: readonly Entry[]): Entry[] {
  return entries.filter((e) => !isStart(e));
}

export function makeStartEntry(now: Date): Entry {
  return { id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`, at: now.toISOString(), bottleId: STARTED, fraction: 1, oz: 0 };
}

export interface BottleDuration {
  /** Minutes from the start (or the previous finish) to this finish. */
  minutes: number;
  /** Ounces of this drink over its duration; null when the duration is 0. */
  ozPerHour: number | null;
  /** True when this is the day's first drink and the user tapped Started bottle. */
  fromStart: boolean;
}

/**
 * Durations for one day's entries, keyed by entry id. Untimed backfill rows carry no duration and
 * do not break the chain. Only the first drink may use a start marker; a start tapped after a
 * finish is ignored (the previous finish is the truer start).
 */
export function bottleDurations(dayEntries: readonly Entry[]): Map<string, BottleDuration> {
  const out = new Map<string, BottleDuration>();
  const sorted = [...dayEntries].filter((e) => !e.untimed).sort((a, b) => a.at.localeCompare(b.at));
  let prevFinish: number | null = null;
  let start: number | null = null;
  let firstDrink = true;
  for (const e of sorted) {
    const t = new Date(e.at).getTime();
    if (isStart(e)) {
      if (firstDrink && start === null) start = t;
      continue;
    }
    const from = firstDrink ? start : prevFinish;
    if (from !== null && t >= from) {
      const minutes = Math.round((t - from) / 60000);
      out.set(e.id, { minutes, ozPerHour: minutes > 0 ? Math.round((e.oz / minutes) * 60 * 10) / 10 : null, fromStart: firstDrink });
    }
    prevFinish = t;
    firstDrink = false;
  }
  return out;
}

/** Group entries by local day and compute every duration on record. */
export function allDurations(entries: readonly Entry[]): Map<string, BottleDuration> {
  const byDay = new Map<string, Entry[]>();
  for (const e of entries) {
    const k = dayKey(new Date(e.at));
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const out = new Map<string, BottleDuration>();
  for (const list of byDay.values()) for (const [id, d] of bottleDurations(list)) out.set(id, d);
  return out;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export interface DurationStats {
  /** Median minutes per full bottle (fraction 1, a Settings bottle, not a one-off cup). */
  medianFullBottleMinutes: number | null;
  fullBottles: number;
  /** Median oz/hour for drinks finished in each local hour of the day, hours with data only. */
  byHour: { hour: number; ozPerHour: number; drinks: number }[];
}

export function durationStats(entries: readonly Entry[]): DurationStats {
  const durs = allDurations(entries);
  const full: number[] = [];
  const hours = new Map<number, number[]>();
  for (const e of entries) {
    const d = durs.get(e.id);
    if (!d) continue;
    if (e.fraction === 1 && e.bottleId !== "other" && d.minutes > 0) full.push(d.minutes);
    if (d.ozPerHour !== null) {
      const h = new Date(e.at).getHours();
      hours.set(h, [...(hours.get(h) ?? []), d.ozPerHour]);
    }
  }
  return {
    medianFullBottleMinutes: median(full),
    fullBottles: full.length,
    byHour: [...hours].sort((a, b) => a[0] - b[0]).map(([hour, xs]) => ({ hour, ozPerHour: median(xs)!, drinks: xs.length })),
  };
}

/** "1h 12m" / "48m" */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}
