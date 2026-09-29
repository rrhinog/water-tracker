// Picking the time a drink really happened: editing a logged time, and logging for yesterday.
// Pure functions, no browser APIs. Times are local wall-clock "HH:MM" strings, the value an
// <input type="time"> reads and writes.
import { dayKey, type Entry } from "./log";

/** Where the time picker starts when logging for yesterday: a forgotten evening bottle. */
export const YESTERDAY_DEFAULT_TIME = "21:00";

/** "HH:MM" → hours and minutes, or null for anything that is not a real time of day. */
export function parseTime(hhmm: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const h = Number(match[1]), m = Number(match[2]);
  return h < 24 && m < 60 ? { h, m } : null;
}

/** A date's local time as "HH:MM", the format <input type="time"> uses. */
export function timeValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * The local day `offset` days from `day` (−1 = the day before), at hh:mm. Built from calendar
 * fields, never by subtracting 24 hours: on a daylight-saving day that lands on the wrong date.
 */
export function atOnDay(day: Date, offset: number, hhmm: string): Date | null {
  const t = parseTime(hhmm);
  if (!t) return null;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + offset, t.h, t.m);
}

/** Yesterday (relative to now) at hh:mm. Always in the past, so never needs a future check. */
export function yesterdayAt(hhmm: string, now: Date): Date | null {
  return atOnDay(now, -1, hhmm);
}

export type Retime = { ok: true; entry: Entry } | { ok: false; error: string };

/**
 * The same entry (same id) finished at another time on its own day. It never moves to another day
 * and never into the future. A clock-change gap (02:30 on the spring-forward night) resolves to the
 * next real time on that same day. Saving the result is an upsert on the id.
 */
export function retime(entry: Entry, hhmm: string, now: Date): Retime {
  const day = new Date(entry.at);
  const at = atOnDay(day, 0, hhmm);
  if (!at) return { ok: false, error: "Pick a time" };
  if (dayKey(at) !== dayKey(day)) return { ok: false, error: "Keep it on the same day" };
  if (at.getTime() > now.getTime()) return { ok: false, error: "That time hasn't happened yet" };
  // A timed value clears the backfill flag: the row now has a real time.
  const { untimed: _untimed, ...rest } = entry;
  void _untimed;
  return { ok: true, entry: { ...rest, at: at.toISOString() } };
}
