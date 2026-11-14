"use client";

// Today's Floors card. Thin: the counting is in src/lib/floors.ts.
import { dayKey } from "@/lib/log";
import type { StepsSummary, Tally } from "@/lib/floors";

const TIME_FMT = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });
const DAY_FMT = new Intl.DateTimeFormat([], { weekday: "short", day: "numeric", month: "short" });
const SINCE_FMT = new Intl.DateTimeFormat([], { day: "numeric", month: "short" });
const NUM_FMT = new Intl.NumberFormat();

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const pct = (t: Tally) => (t.total ? `${Math.round((t.clean / t.total) * 100)}%` : "–");

/** The card's window in words: "since 1 Mar" with a count-from date, else "last 30 days". */
export function floorsLabel(from: string | null): string {
  if (!from) return "last 30 days";
  const [y, m, d] = from.split("-").map(Number);
  return `since ${SINCE_FMT.format(new Date(y, m - 1, d))}`;
}

/** "as of 12:00 PM" today, or "as of Tue 3 Mar, 9:00 PM" for an older sync. Never "now". */
export function asOfLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  return dayKey(d) === dayKey(now) ? `as of ${TIME_FMT.format(d)}` : `as of ${DAY_FMT.format(d)}, ${TIME_FMT.format(d)}`;
}

/** The Floors: the water floor's hit-rate, and steps when a steps source is set up. */
export function FloorsCard({ windowLabel, water, waterToday, steps, stepsFloor, stepsState, now }: {
  windowLabel: string;
  water: Tally;
  waterToday: string;
  steps: StepsSummary | null;
  stepsFloor: number;
  stepsState: "ok" | "unreachable" | "off";
  now: Date;
}) {
  return (
    <section className="ink-card" aria-label="Floors">
      <div className="ink-card__head"><span>Floors</span><span className="mono" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-300)", textTransform: "uppercase" }}>{windowLabel}</span></div>
      <ul className="ink-list" style={{ borderTop: 0 }}>
        <li style={{ fontSize: 15, minHeight: 52, flexWrap: "wrap", rowGap: 6, borderBottom: stepsState === "off" ? 0 : undefined }}>
          <span style={{ minWidth: 0 }}>
            Water
            <span className="ink-list__meta" style={{ display: "block", marginTop: 4 }}>{waterToday} today</span>
          </span>
          <span className="mono ml-auto" style={{ whiteSpace: "nowrap" }}>{water.clean}/{water.total} <span className="ink-badge">{pct(water)}</span></span>
        </li>
        {stepsState !== "off" && (
          <li style={{ fontSize: 15, minHeight: 52, flexWrap: "wrap", rowGap: 6, borderBottom: 0 }}>
            <span style={{ minWidth: 0 }}>
              Steps
              <span className="ink-list__meta" style={{ display: "block", marginTop: 4 }}>
                {steps?.asOf
                  ? `${NUM_FMT.format(steps.today?.steps ?? 0)} today · ${asOfLabel(steps.asOf, now)}`
                  : stepsState === "unreachable" ? "steps source unreachable" : "no steps yet"}
                {` · floor ${NUM_FMT.format(stepsFloor)}`}
                {steps && steps.noData > 0 && ` · no data for ${plural(steps.noData, "day")}`}
              </span>
            </span>
            {steps && <span className="mono ml-auto" style={{ whiteSpace: "nowrap" }}>{steps.tally.clean}/{steps.tally.total} <span className="ink-badge">{pct(steps.tally)}</span></span>}
          </li>
        )}
      </ul>
    </section>
  );
}
