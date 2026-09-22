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
