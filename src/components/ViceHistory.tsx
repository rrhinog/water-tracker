"use client";

// One vice's History section, laid out like coffee's: run now and best, a calendar of slip days, by
// kind, by month, and every slip with remove. The counting is in src/lib/vices.ts.
import { useState } from "react";
import { dayDate } from "@/components/Vices";
import { addDays } from "@/lib/history";
import { dayKey } from "@/lib/log";
import type { Vice } from "@/lib/settings";
import { bestRun, recordStart, slipCounts, slipDays, slipMonths, slipsByKind, viceStatus, type Slip } from "@/lib/vices";

const MONTH_FMT = new Intl.DateTimeFormat([], { month: "short", year: "numeric" });
const DATE_FMT = new Intl.DateTimeFormat([], { weekday: "short", day: "numeric", month: "short" });
const TIME_FMT = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });
const HEAD_NOTE = { font: "500 13px/1 var(--font-mono)", color: "var(--ink-300)" } as const;
const BIG = { margin: "6px 0 0", font: "600 30px/1 var(--font-mono)" } as const;
const UNIT = { font: "400 14px/1 var(--font-sans)", color: "var(--ink-700)" } as const;
const SMALL = { margin: "6px 0 0", fontSize: 12 } as const;

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return MONTH_FMT.format(new Date(y, m - 1, 1));
}

export default function ViceHistory({ vice, slips, onRemove }: { vice: Vice; slips: readonly Slip[]; onRemove: (id: string) => void }) {
  const now = new Date();
  const today = dayKey(now);
  const mine = slips.filter((s) => s.vice === vice.id);
  const miss = slipDays(mine, vice.id);
  const status = viceStatus(vice, mine, now);
  const start = recordStart(vice, miss);
  const best = bestRun(miss, start, addDays(today, -1));
  const counts = slipCounts(mine, now);
  const months = slipMonths(mine, start, today);
  const kinds = slipsByKind(mine);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [showAll, setShowAll] = useState(false);
  const firstMonth = months.length ? months[months.length - 1].month : month;
  const [y, m] = month.split("-").map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay();
  const perDay = new Map<string, number>();
  for (const s of mine) perDay.set(dayKey(new Date(s.at)), (perDay.get(dayKey(new Date(s.at))) ?? 0) + 1);
  const cells = Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => {
    const k = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { day: k, n: perDay.get(k) ?? 0, outside: k > today || !start || k < start };
  });
  const inMonth = cells.reduce((a, c) => a + c.n, 0);
  const log = [...mine].sort((a, b) => b.at.localeCompare(a.at));
  const shown = showAll ? log : log.slice(0, 20);
  const slipWord = (n: number) => (n === 1 ? "slip" : "slips");
  const hId = `vice-${vice.id}-h`;

  return (
    <section className="flex flex-col gap-4 lg:gap-6" aria-labelledby={hId}>
      <div className="flex items-end justify-between" style={{ marginTop: 8 }}>
        <div className="flex flex-col gap-1">
          <span className="eyebrow">{vice.name}</span>
          <h2 id={hId} style={{ margin: 0, font: "700 26px/1.1 var(--font-sans)", letterSpacing: "-0.02em" }}>{vice.name}-free</h2>
        </div>
        <span className="ink-tag">target: zero</span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="ink-card"><div className="ink-card__body" style={{ padding: 16 }}><span className="eyebrow">Run now</span><p style={BIG}>{status.run}<span style={UNIT}> days</span></p><p className="ink-list__meta" style={SMALL}>{status.total ? `clean ${status.clean} of ${status.total} days` : "today: pending"}</p></div></div>
        <div className="ink-card"><div className="ink-card__body" style={{ padding: 16 }}><span className="eyebrow">Best run</span><p style={BIG}>{best.best}<span style={UNIT}> days</span></p>{best.bestEnd && <p className="ink-list__meta" style={SMALL}>ended {best.bestEnd}</p>}</div></div>
        <div className="ink-card"><div className="ink-card__body" style={{ padding: 16 }}><span className="eyebrow">This week</span><p style={BIG}>{counts.thisWeek}<span style={UNIT}> {slipWord(counts.thisWeek)}</span></p></div></div>
        <div className="ink-card"><div className="ink-card__body" style={{ padding: 16 }}><span className="eyebrow">This month</span><p style={BIG}>{counts.thisMonth}<span style={UNIT}> {slipWord(counts.thisMonth)}</span></p></div></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <div className="flex flex-col gap-4 lg:gap-6">
          <div className="ink-card">
            <div className="ink-card__head">
              <div className="flex items-center gap-3">
                <button type="button" className="ink-btn ink-btn--inverse ink-btn--icon" onClick={() => setMonth(addDays(`${month}-01`, -1).slice(0, 7))} disabled={month <= firstMonth} aria-label={`Previous month (${vice.name})`}>{"‹"}</button>
                <span>{monthLabel(month)}</span>
                <button type="button" className="ink-btn ink-btn--inverse ink-btn--icon" onClick={() => setMonth(addDays(`${month}-28`, 5).slice(0, 7))} disabled={month >= today.slice(0, 7)} aria-label={`Next month (${vice.name})`}>{"›"}</button>
              </div>
              <span className="mono" style={HEAD_NOTE}>{inMonth} {slipWord(inMonth)}</span>
            </div>
            <div className="ink-card__body" style={{ padding: "12px 16px 16px" }}>
              <div className="grid grid-cols-7 gap-1">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i} className="cal-cell" style={{ border: 0, color: "var(--ink-500)" }}>{d}</span>)}
                {Array.from({ length: firstDow }, (_, i) => <span key={`pad${i}`} />)}
                {cells.map((c) => (
                  <span key={c.day} className={`cal-cell ${c.n > 0 ? "slip" : ""} ${c.day === today ? "today" : ""}`} style={c.n === 0 && c.outside ? { opacity: 0.4 } : undefined}
                    title={c.n > 0 ? `${c.day}: ${c.n} ${slipWord(c.n)}` : c.outside ? `${c.day}: not counted` : `${c.day}: clean`}>
                    {Number(c.day.slice(-2))}
                  </span>
                ))}
              </div>
              <p style={{ margin: "10px 0 0", font: "400 12px/1.4 var(--font-sans)", color: "var(--ink-700)" }}>Filled = a slip day. Blank = clean. Faded = before the record starts, or not yet.</p>
            </div>
          </div>

          {kinds.length > 0 && (
            <div className="ink-card">
              <div className="ink-card__head"><span>By kind</span><span className="mono" style={HEAD_NOTE}>all time</span></div>
              <ul className="ink-list" style={{ borderTop: 0 }}>
                {kinds.map((k, i, arr) => (
                  <li key={k.kind} style={{ fontSize: 15, minHeight: 44, borderBottom: i === arr.length - 1 ? 0 : undefined }}>
                    <span>{k.kind}</span><span className="ink-badge">{k.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {months.length > 0 && (
            <div className="ink-card">
              <div className="ink-card__head"><span>By month</span><span className="mono" style={HEAD_NOTE}>{months.length} months</span></div>
              <table className="w-full" style={{ fontSize: 15 }}>
                <thead><tr className="eyebrow" style={{ textAlign: "left" }}><th style={{ padding: "10px 24px 6px", fontWeight: 500 }}>month</th><th style={{ textAlign: "right", fontWeight: 500 }}>slips</th><th style={{ textAlign: "right", fontWeight: 500 }}>slip days</th><th style={{ textAlign: "right", padding: "10px 24px 6px", fontWeight: 500 }}>clean</th></tr></thead>
                <tbody className="mono">
                  {months.map((r) => (
                    <tr key={r.month} style={{ borderTop: "2px solid var(--ink-900)" }}>
                      <td style={{ padding: "10px 24px" }}>{monthLabel(r.month)}</td>
                      <td style={{ textAlign: "right" }}>{r.slips}</td>
                      <td style={{ textAlign: "right" }}>{r.slipDays}</td>
                      <td style={{ textAlign: "right", padding: "10px 24px" }}><span className="ink-badge">{r.cleanDays}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="ink-card">
          <div className="ink-card__head"><span>Every slip</span><span className="mono" style={HEAD_NOTE}>{log.length} on record</span></div>
          {log.length === 0 ? (
            <div className="ink-card__body"><p className="ink-empty__text" style={{ margin: 0 }}>{start ? `None since ${DATE_FMT.format(dayDate(start))}.` : "None on record."}</p></div>
          ) : (
            <>
              <ul className="ink-list" style={{ borderTop: 0 }}>
                {shown.map((s, i, arr) => {
                  const at = new Date(s.at);
                  return (
                    <li key={s.id} style={{ fontSize: 15, minHeight: 48, borderBottom: i === arr.length - 1 && (showAll || log.length <= 20) ? 0 : undefined }}>
                      <span>
                        {DATE_FMT.format(at)}{s.kind ? ` · ${s.kind}` : ""}
                        <span className="ink-list__meta" style={{ display: "block", marginTop: 4 }}>{s.fromNotes ? "from notes" : TIME_FMT.format(at)}</span>
                      </span>
                      <button type="button" className="ink-btn ink-btn--ghost ink-btn--sm ink-btn--icon" aria-label={`Remove ${vice.name} slip on ${dayKey(at)}`} onClick={() => onRemove(s.id)}>{"✕"}</button>
                    </li>
                  );
                })}
              </ul>
              {!showAll && log.length > 20 && (
                <div className="ink-card__body" style={{ padding: 16 }}>
                  <button type="button" className="ink-btn" style={{ width: "100%" }} onClick={() => setShowAll(true)}>Show all {log.length}</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
