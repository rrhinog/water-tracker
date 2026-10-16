// Steps from an optional outside source (docs/specs/vices.md, "Steps"). Pure; /api/steps does the I/O.
//
// STEPS_DATABASE_URL points at a read-only Postgres login that can read one view, daily_steps
// (day date, steps integer, synced_at timestamptz). Unset or empty: no steps anywhere in the app.
import { isIsoDay } from "./settings";
import type { StepsDay } from "./vices";

/** The view the app reads, and the only thing its login needs to see. */
export const STEPS_VIEW = "daily_steps";

/** How far back the app asks for: a long Pact plus some History. */
export const STEPS_DAYS_BACK = 400;

/** The source's URL, or null when steps are switched off. */
export function stepsUrl(env: Record<string, string | undefined>): string | null {
  const url = env.STEPS_DATABASE_URL?.trim();
  return url ? url : null;
}

/** The view's rows as the app's shape. Rows that are not a real day with a whole, non-negative count are skipped. */
export function toStepsDays(rows: readonly { day: unknown; steps: unknown; synced_at: unknown }[]): StepsDay[] {
  const out: StepsDay[] = [];
  for (const r of rows) {
    const steps = Number(r.steps);
    const synced = r.synced_at instanceof Date ? r.synced_at : new Date(String(r.synced_at));
    if (!isIsoDay(r.day) || !Number.isFinite(steps) || steps < 0 || Number.isNaN(synced.getTime())) continue;
    out.push({ day: r.day, steps: Math.round(steps), syncedAt: synced.toISOString() });
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

/** What /api/steps answers: off, the rows, or on but unreachable. */
export type StepsResponse = { enabled: false } | { enabled: true; days: StepsDay[] } | { enabled: true; error: string };
