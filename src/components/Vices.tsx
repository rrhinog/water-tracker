"use client";

// Today's vice cards, the Pact card and the Floors card. Thin: the counting is in src/lib/vices.ts.
import { useState, type ReactNode } from "react";
import { dayKey } from "@/lib/log";
import type { Pact, Vice } from "@/lib/settings";
import { COFFEE_QUIT, makeSlip, viceStatus, type PactStatus, type Slip, type StepsSummary, type Tally } from "@/lib/vices";
import { retime, timeValue, YESTERDAY_DEFAULT_TIME, yesterdayAt } from "@/lib/when";

const TIME_FMT = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });
const DAY_FMT = new Intl.DateTimeFormat([], { weekday: "short", day: "numeric", month: "short" });
const NUM_FMT = new Intl.NumberFormat();
const META = { font: "400 14px/1.4 var(--font-sans)", color: "var(--ink-700)" } as const;
const BIG = { font: "600 26px/1 var(--font-mono)" } as const;
const UNIT = { font: "400 14px/1 var(--font-sans)", color: "var(--ink-700)" } as const;

/** "2026-03-01" as a local date, for display. */
export function dayDate(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const pct = (t: Tally) => (t.total ? `${Math.round((t.clean / t.total) * 100)}%` : "–");

/** A quit's display name: "Coffee", or the vice's name (its id if it was removed from Settings). */
export function quitName(id: string, vices: readonly Vice[]): string {
  if (id === COFFEE_QUIT) return "Coffee";
  return vices.find((v) => v.id === id)?.name ?? id;
}

/**
 * One vice: "Alcohol-free · clean 31 of 33 days · run 12 days", a Slip button that opens the chips, and
 * today's slips with edit-a-time and remove. `onLogged` gets the new slip (Today wires the undo bar).
 */
export function ViceCard({ vice, slips, now, undoBar, onLogged, onUpdate, onRemove }: {
  vice: Vice;
  slips: readonly Slip[];
  now: Date;
  undoBar: ReactNode;
  onLogged: (slip: Slip) => void;
  onUpdate: (slip: Slip) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [forYesterday, setForYesterday] = useState(false);
  const [yesterdayTime, setYesterdayTime] = useState(YESTERDAY_DEFAULT_TIME);
  const [editing, setEditing] = useState<{ id: string; value: string; error: string | null } | null>(null);
  const s = viceStatus(vice, slips, now);
  const today = slips.filter((x) => x.vice === vice.id && dayKey(new Date(x.at)) === dayKey(now));

  function log(kind?: string) {
    const at = forYesterday ? (yesterdayAt(yesterdayTime, new Date()) ?? yesterdayAt(YESTERDAY_DEFAULT_TIME, new Date())!) : new Date();
    onLogged(makeSlip(vice.id, at, kind));
    setOpen(false);
    setForYesterday(false);
    setYesterdayTime(YESTERDAY_DEFAULT_TIME);
  }
  function saveTime(slip: Slip) {
    if (!editing) return;
    const r = retime(slip, editing.value, new Date());
    if (!r.ok) return setEditing({ ...editing, error: r.error });
    onUpdate(r.entry);
    setEditing(null);
  }

  const record = s.start === null
    ? "the record starts with a clean-since date or the first slip"
    : s.total === 0 ? `clean since ${DAY_FMT.format(dayDate(s.start))}` : `clean ${s.clean} of ${plural(s.total, "day")}`;

  return (
    <section className="ink-card" aria-label={`${vice.name}-free`}>
      <div className="ink-card__head undo-anchor">
        <span>{vice.name}-free</span>
        <button type="button" className="ink-btn" aria-expanded={open} aria-label={`Slip: ${vice.name}`} onClick={() => setOpen(!open)}>Slip</button>
        {undoBar}
      </div>
      {/* Wraps: at large display sizes the badge drops under the run instead of widening the page. */}
      <div className="ink-card__body flex flex-wrap items-baseline justify-between" style={{ padding: "14px 24px", rowGap: 8, columnGap: 12 }}>
        <span style={BIG}>{s.run} <span style={UNIT}>{s.run === 1 ? "day" : "days"} run</span></span>
        <span className="ink-badge">{s.todayCount === 0 ? "clean so far" : `${plural(s.todayCount, "slip")} today`}</span>
        <span className="w-full" style={META}>{record}</span>
      </div>
      {open && (
        <div className="ink-card__body flex flex-col gap-3" style={{ borderTop: "2px solid var(--ink-900)", padding: 16 }}>
          {vice.chips.length > 0 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label={`What it was (${vice.name})`}>
              {vice.chips.map((c) => (
                <button key={c} type="button" className="ink-chip" onClick={() => log(c)}>{c}</button>
              ))}
            </div>
          ) : (
            <button type="button" className="ink-btn ink-btn--primary" onClick={() => log()}>Log a slip</button>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5" role="group" aria-label={`Slip for (${vice.name})`}>
              <button type="button" className="ink-chip" style={{ padding: "0 12px", fontSize: 13 }} aria-pressed={!forYesterday} onClick={() => setForYesterday(false)}>Now</button>
              <button type="button" className="ink-chip" style={{ padding: "0 12px", fontSize: 13 }} aria-pressed={forYesterday} onClick={() => setForYesterday(true)}>Yesterday</button>
            </div>
            {forYesterday && (
              <label className="flex items-center gap-2" style={{ fontSize: 14, color: "var(--ink-700)" }}>
                at
                <input type="time" className="ink-input mono" style={{ width: 132 }} value={yesterdayTime} onChange={(e) => setYesterdayTime(e.target.value)} aria-label={`Slip time yesterday (${vice.name})`} />
              </label>
            )}
            <button type="button" className="ink-btn ink-btn--ghost ink-btn--sm ml-auto" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
      {today.length > 0 && (
        <ul className="ink-list" style={{ borderTop: "2px solid var(--ink-900)" }}>
          {[...today].reverse().map((x, i, arr) => {
            const time = TIME_FMT.format(new Date(x.at));
            const edit = editing?.id === x.id ? editing : null;
            return (
              <li key={x.id} style={{ fontSize: 15, minHeight: 48, borderBottom: i === arr.length - 1 ? 0 : undefined, flexWrap: "wrap", rowGap: 6 }}>
                <span style={{ minWidth: 0 }}>
                  {x.kind ?? "Slip"}
                  {!edit && (
                    <span className="ink-list__meta" style={{ display: "block", marginTop: 4 }}>
                      <button type="button" className="time-btn" aria-label={`Change slip time, ${time}`} onClick={() => setEditing({ id: x.id, value: timeValue(new Date(x.at)), error: null })}>{time}</button>
                    </span>
                  )}
                </span>
                {edit && (
                  <span className="flex w-full flex-col gap-2" style={{ order: 3 }}>
                    <span className="flex flex-wrap items-center gap-2">
                      <input type="time" className="ink-input mono" style={{ width: 132 }} value={edit.value} max={timeValue(now)} aria-label="Slipped at"
                        onChange={(ev) => setEditing({ ...edit, value: ev.target.value, error: null })} />
                      <button type="button" className="ink-btn ink-btn--primary ink-btn--sm" onClick={() => saveTime(x)}>Save time</button>
                      <button type="button" className="ink-btn ink-btn--ghost ink-btn--sm" onClick={() => setEditing(null)}>Cancel</button>
                    </span>
                    {edit.error && <span role="alert" style={{ fontSize: 14, fontWeight: 600 }}>{edit.error}</span>}
                  </span>
                )}
                <button type="button" className="ink-btn ink-btn--ghost ink-btn--sm ink-btn--icon ml-auto" aria-label={`Remove ${x.kind ?? "slip"} at ${time}`} onClick={() => onRemove(x.id)}>{"✕"}</button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The Pact: one combined clean day as the headline, the run beside it, each quit's hit-rate underneath. */
export function PactCard({ pact, status, vices }: { pact: Pact; status: PactStatus; vices: readonly Vice[] }) {
  const right = status.phase === "upcoming" ? `starts ${DAY_FMT.format(dayDate(pact.start))}` : status.phase === "done" ? "finished" : `day ${status.day} of ${pact.days}`;
  return (
    <section className="ink-card" aria-label={pact.name}>
      <div className="ink-card__head"><span>{pact.name}</span><span className="mono" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-300)", textTransform: "uppercase" }}>{right}</span></div>
      <div className="ink-card__body flex flex-wrap items-baseline justify-between" style={{ padding: "14px 24px", rowGap: 8, columnGap: 12 }}>
        {status.phase === "upcoming" ? (
          <span style={META}>{plural(pact.days, "day")} from {DAY_FMT.format(dayDate(pact.start))}, clean of {pact.quits.map((q) => quitName(q, vices)).join(", ") || "nothing yet"}.</span>
        ) : (
          <>
            <span style={BIG}>
              {status.combined.clean} <span style={UNIT}>of {plural(status.combined.total, "day")} clean</span>
            </span>
            <span className="ink-badge">run {plural(status.run, "day")}</span>
            <span className="w-full" style={META}>
              {status.phase === "done" ? `all ${pact.days} days counted` : `so far (of ${pact.days}) · today pending`}
            </span>
          </>
        )}
      </div>
      {status.phase !== "upcoming" && status.quits.length > 0 && (
        <ul className="ink-list" style={{ borderTop: "2px solid var(--ink-900)" }}>
          {status.quits.map((q, i, arr) => (
            <li key={q.id} style={{ fontSize: 15, minHeight: 44, borderBottom: i === arr.length - 1 ? 0 : undefined }}>
              <span>{quitName(q.id, vices)}</span>
              <span className="mono" style={{ whiteSpace: "nowrap" }}>{q.clean}/{q.total} <span className="ink-badge">{pct(q)}</span></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
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
              </span>
            </span>
            {steps && <span className="mono ml-auto" style={{ whiteSpace: "nowrap" }}>{steps.tally.clean}/{steps.tally.total} <span className="ink-badge">{pct(steps.tally)}</span></span>}
          </li>
        )}
      </ul>
    </section>
  );
}
