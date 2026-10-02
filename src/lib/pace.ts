// Pacing: "how much should I have drunk by now?" Two answers to that question.
// Pure functions, no browser APIs.
export type PaceMode = "even" | "history";

export interface PaceWindow {
  /** Local hours the Even mode spreads the floor across. */
  startH: number;
  endH: number;
}

export const DEFAULT_WINDOW: PaceWindow = { startH: 6, endH: 21 };

/** Morning checkpoint: cleared days nearly always had bottle #1 done within 4 h of the window opening. */
export function firstBottleByH(window: PaceWindow): number {
  return Math.min(window.endH, window.startH + 4);
}

export type Curve = ReadonlyArray<readonly [hour: number, oz: number]>;

/**
 * Fallback shape: median ounces logged by each hour on days that cleared the floor
 * (61 days of the author's daily notes, Jul-Sep 2026; 36 cleared), on a 100 oz floor.
 * Used until the user has enough cleared days of their own (see curveFromDays).
 */
export const HISTORY_CURVE: Curve = [
  [6, 0],
  [8, 0],
  [10, 20],
  [12, 40],
  [14, 40],
  [16, 80],
  [18, 80],
  [19, 100],
  [20, 108],
  [22, 120],
];

/** Hours since local midnight as a decimal, e.g. 13.5 for 1:30 PM. */
export function hourOf(date: Date): number {
  return date.getHours() + date.getMinutes() / 60;
}

/** Sample hours for a derived curve. */
export const CURVE_HOURS = [6, 8, 10, 12, 14, 16, 18, 20, 22] as const;

/** How many cleared days with timed drinks before the user's own curve replaces the fallback. */
export const MIN_DAYS_FOR_OWN_CURVE = 10;

export interface DayProfile {
  /** Ounces logged by each hour of the day, in CURVE_HOURS order. */
  cumulative: number[];
}

/**
 * Build a "my history" curve from the user's own cleared days: the median cumulative ounces
 * at each sample hour. Returns null until there are enough days, so callers fall back.
 * The result is in the user's own ounces already (no scaling needed).
 */
export function curveFromDays(profiles: readonly DayProfile[]): Curve | null {
  if (profiles.length < MIN_DAYS_FOR_OWN_CURVE) return null;
  return CURVE_HOURS.map((h, i) => {
    const vals = profiles.map((p) => p.cumulative[i]).sort((a, b) => a - b);
    const mid = Math.floor(vals.length / 2);
    const median = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
    return [h, Math.round(median)] as const;
  });
}

/** Ounces the chosen pace expects by hour `h`. Even is capped at the floor; history may exceed it. */
export function expectedOz(
  mode: PaceMode,
  h: number,
  floorOz = 100,
  window: PaceWindow = DEFAULT_WINDOW,
  ownCurve: Curve | null = null,
): number {
  if (mode === "even") {
    const frac = (h - window.startH) / (window.endH - window.startH);
    return Math.round(Math.max(0, Math.min(1, frac)) * floorOz);
  }
  // An own curve is already in the user's ounces; the fallback is on a 100 oz floor.
  const scale = ownCurve ? 1 : floorOz / 100;
  const curve = ownCurve ?? HISTORY_CURVE;
  if (h <= curve[0][0]) return Math.round(curve[0][1] * scale);
  for (let i = 1; i < curve.length; i++) {
    const [h0, oz0] = curve[i - 1];
    const [h1, oz1] = curve[i];
    if (h <= h1) return Math.round((oz0 + ((h - h0) / (h1 - h0)) * (oz1 - oz0)) * scale);
  }
  return Math.round(curve[curve.length - 1][1] * scale);
}

/** The hour at which the pace first expects more than `oz`. Null if the pace never gets there today. */
export function hourWhenExpected(
  mode: PaceMode,
  oz: number,
  floorOz = 100,
  window: PaceWindow = DEFAULT_WINDOW,
  ownCurve: Curve | null = null,
): number | null {
  for (let h = window.startH; h <= 23.75; h += 0.25) {
    if (expectedOz(mode, h, floorOz, window, ownCurve) > oz) return h;
  }
  return null;
}

export interface PaceStatus {
  expected: number;
  /** Positive = ahead of pace, negative = behind. */
  delta: number;
  /** Local hour the next drink is due, or null if already past due / nothing more expected. */
  nextDueH: number | null;
  firstBottleByH: number;
  firstBottleDone: boolean;
  firstBottleMissed: boolean;
}

export function paceStatus(
  mode: PaceMode,
  totalOz: number,
  now: Date,
  firstEntryAt: Date | null,
  floorOz = 100,
  window: PaceWindow = DEFAULT_WINDOW,
  ownCurve: Curve | null = null,
): PaceStatus {
  const h = hourOf(now);
  const expected = expectedOz(mode, h, floorOz, window, ownCurve);
  const nextDueH = hourWhenExpected(mode, totalOz, floorOz, window, ownCurve);
  const byH = firstBottleByH(window);
  return {
    expected,
    delta: Math.round((totalOz - expected) * 10) / 10,
    nextDueH: nextDueH !== null && nextDueH > h ? nextDueH : null,
    firstBottleByH: byH,
    firstBottleDone: firstEntryAt !== null && hourOf(firstEntryAt) <= byH,
    firstBottleMissed: firstEntryAt === null ? h > byH : hourOf(firstEntryAt) > byH,
  };
}

/** The pace line on the progress bar: where you should be right now, as a share of the floor (0-100). */
export function paceTickPct(expectedNow: number, floorOz: number): number {
  return floorOz > 0 ? Math.max(0, Math.min(100, (expectedNow / floorOz) * 100)) : 0;
}

/**
 * Finish by: the bottle in hand is logged when it's empty, so this is the time to finish it by for
 * today's total, with it, to still be at or above the pace: "Yeti by 2:15 PM to stay on pace".
 * "clears" when the bottle takes you past the floor. Null when there is no deadline to give: the floor
 * is already cleared, or you'd still be behind even finishing it right now (the card says "drink now").
 */
export type FinishBy = { kind: "by"; h: number } | { kind: "clears" } | null;

export function finishBy(
  mode: PaceMode,
  totalOz: number,
  bottleOz: number,
  now: Date,
  floorOz = 100,
  window: PaceWindow = DEFAULT_WINDOW,
  ownCurve: Curve | null = null,
): FinishBy {
  if (totalOz >= floorOz) return null;
  if (totalOz + bottleOz >= floorOz) return { kind: "clears" };
  const h = hourWhenExpected(mode, totalOz + bottleOz, floorOz, window, ownCurve);
  return h !== null && h > hourOf(now) ? { kind: "by", h } : null;
}

/** "Evening": one hour before the pace window ends (8 PM with the default 6 AM-9 PM window). */
export function eveningH(window: PaceWindow): number {
  return Math.max(window.startH, window.endH - 1);
}

/** Back-loaded: more than this share of the floor would be left for the evening. */
export const BACKLOADED_SHARE = 0.25;

/**
 * Evening warning: keep today's rate so far (ounces since the window opened, per hour) until the
 * evening hour, and what's still missing then is what you'd need after it: "you'll need 60 oz after
 * 8 PM". Only shown when that is back-loaded, from the first-bottle checkpoint until the evening hour,
 * and never once the floor is cleared.
 */
export function eveningNeed(totalOz: number, now: Date, floorOz = 100, window: PaceWindow = DEFAULT_WINDOW): { oz: number; afterH: number } | null {
  const h = hourOf(now);
  const evening = eveningH(window);
  if (totalOz >= floorOz || h >= evening || h < firstBottleByH(window)) return null;
  const rate = totalOz / (h - window.startH);
  const need = floorOz - (totalOz + rate * (evening - h));
  return need > floorOz * BACKLOADED_SHARE ? { oz: Math.round(need), afterH: evening } : null;
}

/**
 * Same time last week: ounces logged `daysAgo` days ago by the same clock time as `now`. Null when that
 * day has no timed drinks to compare with (nothing logged, or only backfill with no time).
 */
export function ozBySameTimeDaysAgo(
  entries: readonly { at: string; oz: number; untimed?: boolean }[],
  now: Date,
  daysAgo = 7,
): number | null {
  const then = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, now.getHours(), now.getMinutes(), now.getSeconds());
  const sameDay = (d: Date) => d.getFullYear() === then.getFullYear() && d.getMonth() === then.getMonth() && d.getDate() === then.getDate();
  const timed = entries.filter((e) => !e.untimed && sameDay(new Date(e.at)));
  if (!timed.some((e) => e.oz > 0)) return null;
  const sum = timed.filter((e) => new Date(e.at).getTime() <= then.getTime()).reduce((a, e) => a + e.oz, 0);
  return Math.round(sum * 10) / 10;
}

export function formatHour(h: number): string {
  const d = new Date(2000, 0, 1, Math.floor(h), Math.round((h % 1) * 60));
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
