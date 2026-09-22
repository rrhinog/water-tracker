"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import { coffeeHistory, coffeeMonths, coffeesByDay, coffeeStatus } from "@/lib/coffee";
import { addDays, buildDays, chartBars, firstBottleTable, monthCells, periodStats, streaks, type Period } from "@/lib/history";
import { dayKey } from "@/lib/log";
import { toUnit, unitLabel } from "@/lib/settings";
import { useSynced } from "@/lib/useSynced";

const MONTH_FMT = new Intl.DateTimeFormat([], { month: "long", year: "numeric" });
const DATE_FMT = new Intl.DateTimeFormat([], { weekday: "short", day: "numeric", month: "short" });
const TIME_FMT = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return MONTH_FMT.format(new Date(y, m - 1, 1));
}

export default function History() {
  const { entries, coffees, settings, sync, removeCoffee } = useSynced();
  const floor = settings.floorOz;
  const unit = settings.unit;
  const u = unitLabel(unit);
  const today = dayKey(new Date());
  const days = buildDays(entries, floor);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [period, setPeriod] = useState<Period>("week");

  const bars = chartBars(days, today, period, floor);
  const s = streaks(days, today);
  const months = periodStats(days, "month");
  const table = period === "month" ? months : periodStats(days, period).slice(-12);
  const firstBottle = firstBottleTable(days, settings.paceStartH + 4);
  const cells = monthCells(days, month);
  const firstMonth = months[0]?.key ?? month;
  const maxOz = Math.max(floor, ...bars.map((d) => d.oz));
  const [y0, m0] = month.split("-").map(Number);
  const firstDow = new Date(y0, m0 - 1, 1).getDay();
  const chartTitle = period === "week" ? "Last 7 days" : period === "month" ? "Last 30 days" : "Last 13 weeks";
  const labelEvery = bars.length > 14 ? 5 : 1;
  const H = 130;
  const clearedInMonth = cells.filter((c) => c.state === "cleared").length;

  // Coffee: the thing to avoid, so a marked day is a miss, not a hit.
  const now = new Date();
  const cStatus = coffeeStatus(coffees, now);
  const cHist = coffeeHistory(coffees, now);
  const cMonths = coffeeMonths(coffees, now).reverse();
  const cByDay = coffeesByDay(coffees);
  const [cMonth, setCMonth] = useState(today.slice(0, 7));
  const cFirstMonth = cMonths.length ? cMonths[cMonths.length - 1].month : cMonth;
  const [cy, cm] = cMonth.split("-").map(Number);
  const cDays = new Date(cy, cm, 0).getDate();
  const cFirstDow = new Date(cy, cm - 1, 1).getDay();
  const cCells = Array.from({ length: cDays }, (_, i) => {
    const k = `${cMonth}-${String(i + 1).padStart(2, "0")}`;
    return { day: k, n: cByDay.get(k) ?? 0, future: k > today };
  });
  const cInMonth = cCells.reduce((a, c) => a + c.n, 0);
  const [showAll, setShowAll] = useState(false);
  const cLog = [...coffees].sort((a, b) => b.at.localeCompare(a.at));
  const cShown = showAll ? cLog : cLog.slice(0, 20);
  const trackedInMonth = cells.filter((c) => c.state !== "none").length;

  return (
    <Shell syncNote={sync === "offline" ? <span className="ink-tag">not synced</span> : null}>
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 lg:max-w-5xl lg:gap-6 lg:p-10">
        <header className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Water</span>
            <h1 style={{ margin: 0, font: "800 34px/1 var(--font-sans)", letterSpacing: "-0.03em" }}>History</h1>
          </div>
          <div className="flex gap-1.5" role="group" aria-label="Period">
            {(["week", "month", "quarter"] as const).map((p) => (
              <button key={p} type="button" className="ink-chip capitalize" style={{ padding: "0 12px", fontSize: 13 }} aria-pressed={period === p} onClick={() => setPeriod(p)}>{p}</button>
            ))}
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <div className="flex flex-col gap-4 lg:gap-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="ink-card"><div className="ink-card__body" style={{ padding: 16 }}><span className="eyebrow">Current streak</span><p style={{ margin: "6px 0 0", font: "600 30px/1 var(--font-mono)" }}>{s.current}<span style={{ font: "400 14px/1 var(--font-sans)", color: "var(--ink-700)" }}> days</span></p></div></div>
              <div className="ink-card"><div className="ink-card__body" style={{ padding: 16 }}><span className="eyebrow">Best streak</span><p style={{ margin: "6px 0 0", font: "600 30px/1 var(--font-mono)" }}>{s.best}<span style={{ font: "400 14px/1 var(--font-sans)", color: "var(--ink-700)" }}> days</span></p>{s.bestEnd && <p className="ink-list__meta" style={{ margin: "6px 0 0", fontSize: 12 }}>ended {s.bestEnd}</p>}</div></div>
            </div>

            <section className="eink" aria-label={chartTitle}>
              <div className="eink__bar"><span>{chartTitle}</span><span className="eink__bar-right">floor {toUnit(floor, unit)} {u}</span></div>
              <div className="eink__body" style={{ padding: "16px 24px 12px" }}>
                <div style={{ position: "relative", height: H, display: "grid", gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`, gap: bars.length > 14 ? 3 : 8, alignItems: "end", borderBottom: "2px solid var(--ink-black)" }}>
                  <div style={{ position: "absolute", left: 0, right: 0, top: H * (1 - floor / maxOz), borderTop: "2px dashed var(--ink-black)" }} aria-hidden="true" />
                  {bars.map((d, i) => (
                    <div key={i} className={`bar ${d.cleared ? "" : "miss"}`} style={{ height: Math.max(0, (d.oz / maxOz) * H), borderRadius: bars.length > 14 ? "2px 2px 0 0" : undefined }}
                      title={`${d.label}: ${toUnit(d.oz, unit)} ${u}${d.cleared ? " (cleared)" : ""}${d.days > 1 ? ` avg over ${d.days} days` : ""}`} />
                  ))}
                </div>
                {bars.length <= 13 && (
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`, gap: 8, marginTop: 6, font: "500 11px/1 var(--font-mono)", color: "var(--ink-700)", textAlign: "center" }}>
                    {bars.map((d, i) => <span key={i}>{d.oz > 0 ? toUnit(d.oz, unit) : ""}</span>)}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`, gap: bars.length > 14 ? 3 : 8, marginTop: 4, font: "500 11px/1 var(--font-sans)", color: "var(--ink-700)", textAlign: "center" }}>
                  {bars.map((d, i) => <span key={i} style={d.isToday ? { color: "var(--ink-black)", fontWeight: 700 } : undefined}>{i % labelEvery === 0 || d.isToday ? d.label : ""}</span>)}
                </div>
              </div>
              <div className="eink__foot"><b>Solid</b><span>cleared</span><b>Outline</b><span>missed</span><b>Dash</b><span>floor</span></div>
            </section>

            <section className="ink-card">
              <div className="ink-card__head">
                <div className="flex items-center gap-3">
                  <button type="button" className="ink-btn ink-btn--inverse ink-btn--icon" onClick={() => setMonth(addDays(`${month}-01`, -1).slice(0, 7))} disabled={month <= firstMonth} aria-label="Previous month">{"‹"}</button>
                  <span>{monthLabel(month)}</span>
                  <button type="button" className="ink-btn ink-btn--inverse ink-btn--icon" onClick={() => setMonth(addDays(`${month}-28`, 5).slice(0, 7))} disabled={month >= today.slice(0, 7)} aria-label="Next month">{"›"}</button>
                </div>
                <span className="mono" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-300)" }}>{clearedInMonth} of {trackedInMonth} cleared</span>
              </div>
              <div className="ink-card__body" style={{ padding: "12px 16px 16px" }}>
                <div className="grid grid-cols-7 gap-1">
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i} className="cal-cell" style={{ border: 0, color: "var(--ink-500)" }}>{d}</span>)}
                  {Array.from({ length: firstDow }, (_, i) => <span key={`pad${i}`} />)}
                  {cells.map((c) => (
                    <span key={c.day} className={`cal-cell ${c.state === "cleared" ? "hit" : c.state === "missed" ? "miss" : ""} ${c.day === today ? "today" : ""}`} title={c.state === "none" ? `${c.day}: no data` : `${c.day}: ${toUnit(c.totalOz, unit)} ${u}`}>
                      {Number(c.day.slice(-2))}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-4 lg:gap-6">
            <section className="ink-card">
              <div className="ink-card__head"><span className="capitalize">By {period}</span><span className="mono" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-300)" }}>{period === "week" ? "last 12" : `${table.length} rows`}</span></div>
              <table className="w-full" style={{ fontSize: 15 }}>
                <thead><tr className="eyebrow" style={{ textAlign: "left" }}><th style={{ padding: "10px 24px 6px", fontWeight: 500 }}>{period}</th><th style={{ textAlign: "right", fontWeight: 500 }}>days</th><th style={{ textAlign: "right", fontWeight: 500 }}>avg {u}</th><th style={{ textAlign: "right", padding: "10px 24px 6px", fontWeight: 500 }}>cleared</th></tr></thead>
                <tbody className="mono">
                  {table.map((m) => (
                    <tr key={m.key} style={{ borderTop: "2px solid var(--ink-900)" }}>
                      <td style={{ padding: "10px 24px" }}>{period === "month" ? monthLabel(m.key) : m.label}</td>
                      <td style={{ textAlign: "right" }}>{m.days}</td>
                      <td style={{ textAlign: "right" }}>{toUnit(m.avgOz, unit)}</td>
                      <td style={{ textAlign: "right", padding: "10px 24px" }}><span className="ink-badge">{m.cleared} · {Math.round((m.cleared / m.days) * 100)}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="ink-card">
              <div className="ink-card__head"><span>First drink vs the floor</span></div>
              <table className="w-full" style={{ fontSize: 15 }}>
                <thead><tr className="eyebrow" style={{ textAlign: "left" }}><th style={{ padding: "10px 24px 6px", fontWeight: 500 }}>first drink</th><th style={{ textAlign: "right", fontWeight: 500 }}>days</th><th style={{ textAlign: "right", fontWeight: 500 }}>cleared</th><th style={{ textAlign: "right", padding: "10px 24px 6px", fontWeight: 500 }}>avg {u}</th></tr></thead>
                <tbody className="mono">
                  {firstBottle.map((b) => (
                    <tr key={b.label} style={{ borderTop: "2px solid var(--ink-900)" }}>
                      <td style={{ padding: "10px 24px" }}>{b.label}</td><td style={{ textAlign: "right" }}>{b.days}</td><td style={{ textAlign: "right" }}>{b.clearPct}%</td><td style={{ textAlign: "right", padding: "10px 24px" }}>{toUnit(b.avgOz, unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="ink-card__body" style={{ margin: 0, padding: "8px 24px 16px", font: "400 13px/1.5 var(--font-sans)", color: "var(--ink-700)" }}>Only days with a timed first drink count here.</p>
            </section>
          </div>
        </div>

        <section className="flex flex-col gap-4 lg:gap-6" aria-labelledby="coffee-h">
          <div className="flex items-end justify-between" style={{ marginTop: 8 }}>
            <div className="flex flex-col gap-1">
              <span className="eyebrow">Coffee</span>
              <h2 id="coffee-h" style={{ margin: 0, font: "700 26px/1.1 var(--font-sans)", letterSpacing: "-0.02em" }}>Coffee-free</h2>
            </div>
            <span className="ink-tag">target: zero</span>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="ink-card"><div className="ink-card__body" style={{ padding: 16 }}><span className="eyebrow">Streak now</span><p style={{ margin: "6px 0 0", font: "600 30px/1 var(--font-mono)" }}>{cStatus.streak}<span style={{ font: "400 14px/1 var(--font-sans)", color: "var(--ink-700)" }}> days</span></p><p className="ink-list__meta" style={{ margin: "6px 0 0", fontSize: 12 }}>{cStatus.todayCount === 0 ? "today: clean so far" : `${cStatus.todayCount} today \u00B7 resets tomorrow`}</p></div></div>
            <div className="ink-card"><div className="ink-card__body" style={{ padding: 16 }}><span className="eyebrow">Best streak</span><p style={{ margin: "6px 0 0", font: "600 30px/1 var(--font-mono)" }}>{cHist.bestStreak}<span style={{ font: "400 14px/1 var(--font-sans)", color: "var(--ink-700)" }}> days</span></p>{cHist.bestStreakEnd && <p className="ink-list__meta" style={{ margin: "6px 0 0", fontSize: 12 }}>ended {cHist.bestStreakEnd}</p>}</div></div>
            <div className="ink-card"><div className="ink-card__body" style={{ padding: 16 }}><span className="eyebrow">This week</span><p style={{ margin: "6px 0 0", font: "600 30px/1 var(--font-mono)" }}>{cHist.thisWeek}<span style={{ font: "400 14px/1 var(--font-sans)", color: "var(--ink-700)" }}> {cHist.thisWeek === 1 ? "coffee" : "coffees"}</span></p></div></div>
            <div className="ink-card"><div className="ink-card__body" style={{ padding: 16 }}><span className="eyebrow">This month</span><p style={{ margin: "6px 0 0", font: "600 30px/1 var(--font-mono)" }}>{cHist.thisMonth}<span style={{ font: "400 14px/1 var(--font-sans)", color: "var(--ink-700)" }}> {cHist.thisMonth === 1 ? "coffee" : "coffees"}</span></p></div></div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
            <div className="flex flex-col gap-4 lg:gap-6">
              <div className="ink-card">
                <div className="ink-card__head">
                  <div className="flex items-center gap-3">
                    <button type="button" className="ink-btn ink-btn--inverse ink-btn--icon" onClick={() => setCMonth(addDays(`${cMonth}-01`, -1).slice(0, 7))} disabled={cMonth <= cFirstMonth} aria-label="Previous month (coffee)">{"\u2039"}</button>
                    <span>{monthLabel(cMonth)}</span>
                    <button type="button" className="ink-btn ink-btn--inverse ink-btn--icon" onClick={() => setCMonth(addDays(`${cMonth}-28`, 5).slice(0, 7))} disabled={cMonth >= today.slice(0, 7)} aria-label="Next month (coffee)">{"\u203A"}</button>
                  </div>
                  <span className="mono" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-300)" }}>{cInMonth} {cInMonth === 1 ? "coffee" : "coffees"}</span>
                </div>
                <div className="ink-card__body" style={{ padding: "12px 16px 16px" }}>
                  <div className="grid grid-cols-7 gap-1">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i} className="cal-cell" style={{ border: 0, color: "var(--ink-500)" }}>{d}</span>)}
                    {Array.from({ length: cFirstDow }, (_, i) => <span key={`pad${i}`} />)}
                    {cCells.map((c) => (
                      <span key={c.day} className={`cal-cell ${c.n > 0 ? "miss" : ""} ${c.day === today ? "today" : ""}`} style={c.n > 0 ? { background: "var(--ink-black)", color: "var(--ink-white)" } : c.future ? { opacity: 0.4 } : undefined} title={c.n > 0 ? `${c.day}: ${c.n} ${c.n === 1 ? "coffee" : "coffees"}` : `${c.day}: coffee-free`}>
                        {Number(c.day.slice(-2))}
                      </span>
                    ))}
                  </div>
                  <p style={{ margin: "10px 0 0", font: "400 12px/1.4 var(--font-sans)", color: "var(--ink-700)" }}>Ink = a coffee day. Blank = coffee-free.</p>
                </div>
              </div>

              <div className="ink-card">
                <div className="ink-card__head"><span>By month</span><span className="mono" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-300)" }}>{cMonths.length} months</span></div>
                <table className="w-full" style={{ fontSize: 15 }}>
                  <thead><tr className="eyebrow" style={{ textAlign: "left" }}><th style={{ padding: "10px 24px 6px", fontWeight: 500 }}>month</th><th style={{ textAlign: "right", fontWeight: 500 }}>coffees</th><th style={{ textAlign: "right", fontWeight: 500 }}>coffee days</th><th style={{ textAlign: "right", padding: "10px 24px 6px", fontWeight: 500 }}>free days</th></tr></thead>
                  <tbody className="mono">
                    {cMonths.map((m) => (
                      <tr key={m.month} style={{ borderTop: "2px solid var(--ink-900)" }}>
                        <td style={{ padding: "10px 24px" }}>{monthLabel(m.month)}</td>
                        <td style={{ textAlign: "right" }}>{m.coffees}</td>
                        <td style={{ textAlign: "right" }}>{m.coffeeDays}</td>
                        <td style={{ textAlign: "right", padding: "10px 24px" }}><span className="ink-badge">{m.freeDays}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="ink-card">
              <div className="ink-card__head"><span>Every coffee</span><span className="mono" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-300)" }}>{cLog.length} on record</span></div>
              {cLog.length === 0 ? (
                <div className="ink-card__body"><p className="ink-empty__text" style={{ margin: 0 }}>None on record.</p></div>
              ) : (
                <>
                  <ul className="ink-list" style={{ borderTop: 0 }}>
                    {cShown.map((c, i, arr) => {
                      const at = new Date(c.at);
                      return (
                        <li key={c.id} style={{ fontSize: 15, minHeight: 48, borderBottom: i === arr.length - 1 && showAll ? 0 : undefined }}>
                          <span>
                            {DATE_FMT.format(at)}
                            <span className="ink-list__meta" style={{ display: "block", marginTop: 4 }}>{c.fromNotes ? "from notes" : TIME_FMT.format(at)}</span>
                          </span>
                          <button type="button" className="ink-btn ink-btn--ghost ink-btn--sm ink-btn--icon" aria-label={`Remove coffee on ${c.at.slice(0, 10)}`} onClick={() => removeCoffee(c.id)}>{"\u2715"}</button>
                        </li>
                      );
                    })}
                  </ul>
                  {!showAll && cLog.length > 20 && (
                    <div className="ink-card__body" style={{ padding: 16 }}>
                      <button type="button" className="ink-btn" style={{ width: "100%" }} onClick={() => setShowAll(true)}>Show all {cLog.length}</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </Shell>
  );
}
