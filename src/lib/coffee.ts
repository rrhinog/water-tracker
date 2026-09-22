// Coffee log + coffee-free streak. Target is zero, so the metric is days WITHOUT.
// Pure functions, no browser APIs.
import { dayKey } from "./log";

export interface CoffeeEntry {
  id: string;
  /** ISO timestamp of when the coffee was logged. */
  at: string;
  /** Day-level row imported from the daily notes (time unknown, set to noon). */
  fromNotes?: boolean;
}

export function makeCoffee(now: Date): CoffeeEntry {
  return { id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`, at: now.toISOString() };
}

/** Every day with a coffee (imported note days and app logs alike). */
export function coffeeDays(entries: readonly CoffeeEntry[]): Set<string> {
  const days = new Set<string>();
  for (const e of entries) days.add(dayKey(new Date(e.at)));
  return days;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export interface CoffeeStatus {
  /** Consecutive coffee-free days ending yesterday. Today is not counted until it is over. */
  streak: number;
  todayCount: number;
  /** ISO day of the most recent coffee on record, or null. */
  lastCoffeeDay: string | null;
}

export function coffeeStatus(entries: readonly CoffeeEntry[], today: Date): CoffeeStatus {
  const days = coffeeDays(entries);
  const todayK = dayKey(today);
  let streak = 0;
  for (let d = addDays(today, -1); !days.has(dayKey(d)); d = addDays(d, -1)) {
    streak++;
    if (streak > 3650) break; // history bound; nobody has a 10-year record here
  }
  const sorted = [...days].sort();
  const last = sorted.filter((k) => k <= todayK).pop() ?? null;
  return {
    streak,
    todayCount: entries.filter((e) => !e.fromNotes && dayKey(new Date(e.at)) === todayK).length,
    lastCoffeeDay: last,
  };
}

/** ISO day -> number of coffees (imported note days count as 1). */
export function coffeesByDay(entries: readonly CoffeeEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) {
    const k = dayKey(new Date(e.at));
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export interface CoffeeHistory {
  /** Longest run of coffee-free days between the first coffee on record and yesterday. */
  bestStreak: number;
  bestStreakEnd: string | null;
  thisWeek: number;
  thisMonth: number;
}

function isoKey(d: Date): string {
  return dayKey(d);
}

/** Streak history plus recent counts. The week is Monday-based; today's coffees are included in the counts. */
export function coffeeHistory(entries: readonly CoffeeEntry[], today: Date): CoffeeHistory {
  const by = coffeesByDay(entries);
  const keys = [...by.keys()].sort();
  let bestStreak = 0, bestStreakEnd: string | null = null;
  if (keys.length) {
    // Walk day by day from the first coffee to yesterday, counting coffee-free runs.
    const [y, m, d] = keys[0].split("-").map(Number);
    let run = 0;
    for (let cur = new Date(y, m - 1, d); isoKey(cur) < isoKey(today); cur = addDays(cur, 1)) {
      if (by.has(isoKey(cur))) { run = 0; continue; }
      run++;
      if (run > bestStreak) { bestStreak = run; bestStreakEnd = isoKey(cur); }
    }
  }
  const dow = today.getDay() || 7; // Mon=1..Sun=7
  const weekStart = isoKey(addDays(today, 1 - dow));
  const monthStart = isoKey(today).slice(0, 7) + "-01";
  const todayK = isoKey(today);
  let thisWeek = 0, thisMonth = 0;
  for (const [k, n] of by) {
    if (k > todayK) continue;
    if (k >= weekStart) thisWeek += n;
    if (k >= monthStart) thisMonth += n;
  }
  return { bestStreak, bestStreakEnd, thisWeek, thisMonth };
}

export interface CoffeeMonth { month: string; coffees: number; coffeeDays: number; freeDays: number }

/** Per-month totals over the months that have any record, from the first coffee to today. */
export function coffeeMonths(entries: readonly CoffeeEntry[], today: Date): CoffeeMonth[] {
  const by = coffeesByDay(entries);
  const keys = [...by.keys()].sort();
  if (!keys.length) return [];
  const out = new Map<string, CoffeeMonth>();
  const [y, m] = keys[0].split("-").map(Number);
  const todayK = isoKey(today);
  for (let cur = new Date(y, m - 1, 1); isoKey(cur) <= todayK; cur = addDays(cur, 1)) {
    const k = isoKey(cur);
    if (k < keys[0]) continue;
    const mo = k.slice(0, 7);
    const row = out.get(mo) ?? { month: mo, coffees: 0, coffeeDays: 0, freeDays: 0 };
    const n = by.get(k) ?? 0;
    row.coffees += n;
    if (n > 0) row.coffeeDays++; else row.freeDays++;
    out.set(mo, row);
  }
  return [...out.values()];
}
