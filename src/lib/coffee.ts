// Coffee log + coffee-free streak. Target is zero, so the metric is days WITHOUT.
// Pure functions, no browser APIs.
import { dayKey } from "./log";

export interface CoffeeEntry {
  id: string;
  /** ISO timestamp of when the coffee was logged. */
  at: string;
  /** Day-level row imported from the daily notes (time unknown, set to noon). */
  fromNotes?: boolean;
  /** ISO timestamp of when it was finished; absent while the coffee is still open. */
  finishedAt?: string;
  /** Which pod (or "Bought out"), as named in Settings when logged. Kept even if the flavour is later removed. */
  flavour?: string;
}

/** An open coffee older than this is assumed finished at the cutoff (a forgotten tap, not a 14-hour latte). */
export const OPEN_COFFEE_MAX_MS = 12 * 60 * 60 * 1000;

export type SipWindow = { minutes: number; assumed: boolean } | null;

/** Brew-to-finished window. Null while open (and within the cutoff) or for imported note days. */
export function sipWindow(c: CoffeeEntry, now: Date): SipWindow {
  if (c.fromNotes) return null;
  const start = new Date(c.at).getTime();
  if (c.finishedAt) return { minutes: Math.max(0, Math.round((new Date(c.finishedAt).getTime() - start) / 60000)), assumed: false };
  if (now.getTime() - start >= OPEN_COFFEE_MAX_MS) return { minutes: OPEN_COFFEE_MAX_MS / 60000, assumed: true };
  return null;
}

/** Still open: no finish recorded and within the cutoff. */
export function isOpen(c: CoffeeEntry, now: Date): boolean {
  return !c.fromNotes && !c.finishedAt && now.getTime() - new Date(c.at).getTime() < OPEN_COFFEE_MAX_MS;
}

export function finishCoffee(c: CoffeeEntry, now: Date): CoffeeEntry {
  return { ...c, finishedAt: now.toISOString() };
}

/** "2h 55m" / "48m" */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function makeCoffee(now: Date, flavour?: string): CoffeeEntry {
  const c: CoffeeEntry = { id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`, at: now.toISOString() };
  if (flavour) c.flavour = flavour;
  return c;
}

/** Coffees per flavour, most first; imported note days have no flavour and are reported as "unknown". */
export function coffeesByFlavour(entries: readonly CoffeeEntry[]): { flavour: string; count: number }[] {
  const m = new Map<string, number>();
  for (const e of entries) {
    const k = e.flavour ?? (e.fromNotes ? "unknown (from notes)" : "unspecified");
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m].map(([flavour, count]) => ({ flavour, count })).sort((a, b) => b.count - a.count);
}

/** The flavour of the most recent app-logged coffee, or null. */
export function lastFlavour(entries: readonly CoffeeEntry[]): string | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (!e.fromNotes && e.flavour) return e.flavour;
  }
  return null;
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
