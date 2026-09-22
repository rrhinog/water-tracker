"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import { FRACTIONS, fractionLabel, type Fraction } from "@/lib/bottles";
import { coffeeStatus, makeCoffee } from "@/lib/coffee";
import { clearedDayProfiles } from "@/lib/history";
import { dayKey, entriesForDay, makeCustomEntry, makeEntry, recentCustomAmounts, totalOz } from "@/lib/log";
import { curveFromDays, formatHour, paceStatus, type PaceMode } from "@/lib/pace";
import { bottleById, fmt, fromUnit, sourceName, toUnit, unitLabel } from "@/lib/settings";
import { loadBottle, loadPaceMode, saveBottle, savePaceMode } from "@/lib/storage";
import { useSynced } from "@/lib/useSynced";

const DAY_FMT = new Intl.DateTimeFormat([], { weekday: "short", day: "numeric", month: "short" });
const TIME_FMT = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" });

export default function Tracker() {
  // Loaded with ssr: false (see page.tsx), so localStorage is readable in lazy initializers.
  const { entries, coffees, settings, sync, pending, addEntry, removeEntry, addCoffee, removeCoffee } = useSynced();
  const { bottles, floorOz, unit } = settings;
  const window = { startH: settings.paceStartH, endH: settings.paceEndH };
  const u = unitLabel(unit);

  const [pickedId, setPickedId] = useState<string | null>(loadBottle);
  const [fractionIdx, setFractionIdx] = useState<number>(FRACTIONS.length - 1);
  const [other, setOther] = useState(false);
  const [paceOverride, setPaceOverride] = useState<PaceMode | null>(loadPaceMode);
  const [customText, setCustomText] = useState("");

  const bottle = (pickedId && bottleById(bottles, pickedId)) || bottles[0];
  const paceMode: PaceMode = paceOverride ?? settings.defaultPaceMode;

  function pickBottle(id: string) {
    setOther(false);
    setPickedId(id);
    saveBottle(id);
  }
  function pickPace(mode: PaceMode) {
    setPaceOverride(mode);
    savePaceMode(mode);
  }
  function logCustom(oz: number) {
    if (!(oz > 0)) return;
    addEntry(makeCustomEntry(oz, new Date()));
    setCustomText("");
    setOther(false);
  }
  function log(fraction: Fraction) {
    addEntry(makeEntry(bottle, fraction, new Date()));
    setFractionIdx(FRACTIONS.length - 1);
  }

  const now = new Date();
  const today = entriesForDay(entries, now);
  const total = totalOz(today);
  const remaining = Math.max(0, floorOz - total);
  const pct = Math.min(100, (total / floorOz) * 100);
  const cleared = total >= floorOz;
  const fraction: Fraction = FRACTIONS[fractionIdx];
  const logOz = Math.round(bottle.oz * fraction * 10) / 10;
  const customValue = Number(customText);
  const customValid = customText !== "" && customValue > 0;
  const customOz = customValid ? fromUnit(customValue, unit) : 0;
  const recents = recentCustomAmounts(entries);
  const firstAt = today.length > 0 ? new Date(today[0].at) : null;
  const ownCurve = curveFromDays(clearedDayProfiles(entries, floorOz));
  const pace = paceStatus(paceMode, total, now, firstAt, floorOz, window, ownCurve);
  const coffee = coffeeStatus(coffees, now);
  const todayCoffees = coffees.filter((c) => !c.fromNotes && dayKey(new Date(c.at)) === dayKey(now));

  // Direction in words, never colour (kit rule).
  const paceWord = cleared ? "Done for the day" : pace.delta >= 0 ? `▲ ${fmt(pace.delta, unit)} ahead` : `▼ ${fmt(Math.abs(pace.delta), unit)} behind`;
  const nextWord = cleared ? "floor cleared" : pace.delta < 0 ? "drink now" : pace.nextDueH !== null ? `next by ${formatHour(pace.nextDueH)}` : "";
  const firstWord = `first bottle by ${formatHour(pace.firstBottleByH)}${pace.firstBottleDone ? " · done" : pace.firstBottleMissed ? " · missed" : ""}`;

  const coffeeCard = (
    <>
      <span className="eyebrow">Coffee-free streak</span>
      <p style={{ margin: "6px 0 0", font: "600 26px/1 var(--font-mono)" }}>
        {coffee.streak} <span style={{ font: "400 14px/1 var(--font-sans)", color: "var(--ink-700)" }}>{coffee.streak === 1 ? "day" : "days"}</span>
      </p>
      <p className="ink-list__meta" style={{ margin: "6px 0 12px" }}>
        {coffee.todayCount === 0 ? "today: clean so far" : `${coffee.todayCount} today · resets tomorrow`}
      </p>
      <button type="button" className="ink-btn ink-btn--sm" style={{ width: "100%" }} onClick={() => addCoffee(makeCoffee(new Date()))}>
        Log a coffee
      </button>
    </>
  );

  const syncNote = sync === "offline" ? <span className="ink-tag">not synced{pending > 0 ? ` · ${pending}` : ""}</span> : null;

  return (
    <Shell aside={coffeeCard} syncNote={syncNote}>
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 lg:max-w-none lg:gap-6 lg:p-10">
        <header className="flex items-end justify-between">
          <div className="flex flex-col gap-1">
            <span className="eyebrow">{DAY_FMT.format(now)}</span>
            <h1 style={{ margin: 0, font: "800 34px/1 var(--font-sans)", letterSpacing: "-0.03em" }} className="lg:!text-[44px]">Today</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="lg:hidden">{syncNote}</span>
            <div className="flex gap-1.5" role="group" aria-label="Pace mode">
              {(["even", "history"] as const).map((m) => (
                <button key={m} type="button" className="ink-chip" style={{ padding: "0 12px", fontSize: 13 }} aria-pressed={paceMode === m} onClick={() => pickPace(m)}>
                  {m === "even" ? "Even" : "My history"}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:gap-6">
          <div className="flex flex-col gap-4 lg:gap-6">
            <section className="eink" aria-label="Today's total">
              <div className="eink__bar"><span>Today</span><span className="eink__bar-right">floor {fmt(floorOz, unit)}</span></div>
              <div className="eink__body" style={{ paddingBottom: 16 }}>
                <p className="eink__text" style={{ margin: "4px 0 6px", font: "600 56px/1 var(--font-mono)", letterSpacing: "-0.03em" }}>
                  {toUnit(total, unit)}
                  <span style={{ font: "500 22px/1 var(--font-mono)", color: "var(--ink-700)" }}> {u}</span>
                </p>
                <p style={{ margin: "0 0 14px", font: "400 15px/1.4 var(--font-sans)", color: "var(--ink-700)" }}>
                  {cleared ? `floor cleared, ${fmt(total - floorOz, unit)} over` : `${fmt(remaining, unit)} to the floor`}
                </p>
                <div style={{ height: 14, border: "2px solid var(--ink-black)", borderRadius: 999, overflow: "hidden", background: "var(--ink-white)" }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="fill" style={{ width: `${pct}%`, height: "100%" }} />
                </div>
              </div>
              <div className="eink__foot"><b>Pace</b><span>{paceWord}</span>{nextWord && <span>{nextWord}</span>}</div>
              {!cleared && (
                <div className="eink__foot" style={{ paddingTop: 0 }}>
                  <span>{firstWord}</span>
                  {paceMode === "history" && !ownCurve && <span style={{ color: "var(--ink-300)" }}>built-in curve until 10 cleared days</span>}
                </div>
              )}
            </section>

            <section className="ink-card">
              <div className="ink-card__head">
                <span>Log a drink</span>
                <span className="mono" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-300)", textTransform: "uppercase" }}>
                  {other ? "other" : `${bottle.name} · ${fmt(bottle.oz, unit)}`}
                </span>
              </div>
              <div className="ink-card__body flex flex-col gap-4">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Bottle">
                  {bottles.map((b) => (
                    <button key={b.id} type="button" className="ink-chip" aria-pressed={!other && b.id === bottle.id} onClick={() => pickBottle(b.id)}>
                      {b.name} <span className="ink-chip__count">{toUnit(b.oz, unit)}</span>
                    </button>
                  ))}
                  <button type="button" className="ink-chip" aria-pressed={other} onClick={() => setOther(true)}>Other</button>
                </div>

                {other ? (
                  <>
                    {recents.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {recents.map((oz) => (
                          <button key={oz} type="button" className="ink-chip" onClick={() => logCustom(oz)}>{fmt(oz, unit)}</button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="number" inputMode="decimal" min={0} step={unit === "ml" ? 1 : 0.1}
                        value={customText} onChange={(e) => setCustomText(e.target.value)}
                        placeholder={unit === "ml" ? "e.g. 500" : "e.g. 16.9"} aria-label={`Amount in ${u}`}
                        className="ink-input mono w-full" style={{ height: 52, fontSize: 22 }}
                      />
                      <span style={{ color: "var(--ink-700)" }}>{u}</span>
                    </div>
                    <button type="button" className="ink-btn ink-btn--primary ink-btn--lg" style={{ height: 56, fontSize: 18 }} disabled={!customValid} onClick={() => logCustom(customOz)}>
                      Log {customValid ? `${customValue} ${u}` : "amount"}
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <input type="range" className="ink-range" min={0} max={FRACTIONS.length - 1} step={1} value={fractionIdx}
                        onChange={(e) => setFractionIdx(Number(e.target.value))} aria-label="Amount of bottle"
                        aria-valuetext={`${fractionLabel(fraction)} bottle, ${fmt(logOz, unit)}`} />
                      <div className="flex justify-between" style={{ font: "500 12px/1 var(--font-mono)", color: "var(--ink-700)" }}>
                        {FRACTIONS.map((f) => <span key={f}>{fractionLabel(f)}</span>)}
                      </div>
                    </div>
                    <button type="button" className="ink-btn ink-btn--primary ink-btn--lg" style={{ height: 56, fontSize: 18 }} onClick={() => log(fraction)}>
                      Log {fmt(logOz, unit)}
                      <span style={{ font: "500 13px/1 var(--font-mono)", opacity: 0.75, marginLeft: 8, textTransform: "uppercase" }}>{fractionLabel(fraction)} {bottle.name}</span>
                    </button>
                  </>
                )}
              </div>
            </section>
          </div>

          <div className="flex flex-col gap-4 lg:gap-6">
            <section className="ink-card lg:hidden">
              <div className="ink-card__head">
                <span>Coffee-free streak</span>
                <button type="button" className="ink-btn ink-btn--inverse" onClick={() => addCoffee(makeCoffee(new Date()))}>Coffee</button>
              </div>
              <div className="ink-card__body flex items-baseline justify-between" style={{ padding: "14px 24px" }}>
                <span style={{ font: "600 26px/1 var(--font-mono)" }}>
                  {coffee.streak} <span style={{ font: "400 14px/1 var(--font-sans)", color: "var(--ink-700)" }}>{coffee.streak === 1 ? "day" : "days"}</span>
                </span>
                <span className="ink-badge">{coffee.todayCount === 0 ? "clean so far" : `${coffee.todayCount} today · resets tomorrow`}</span>
              </div>
              {todayCoffees.length > 0 && (
                <ul className="ink-list" style={{ borderTop: "2px solid var(--ink-900)" }}>
                  {[...todayCoffees].reverse().map((c) => (
                    <li key={c.id} style={{ fontSize: 15, minHeight: 44 }}>
                      <span>Coffee <span className="ink-list__meta">{TIME_FMT.format(new Date(c.at))}</span></span>
                      <button type="button" className="ink-btn ink-btn--ghost ink-btn--sm ink-btn--icon" aria-label="Remove coffee" onClick={() => removeCoffee(c.id)}>{"✕"}</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="ink-card">
              <div className="ink-card__head">
                <span>Logged today</span>
                <span className="mono" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-300)" }}>{today.length} {today.length === 1 ? "drink" : "drinks"}</span>
              </div>
              {today.length === 0 ? (
                <div className="ink-card__body"><p className="ink-empty__text" style={{ margin: 0 }}>Nothing yet.</p></div>
              ) : (
                <ul className="ink-list" style={{ borderTop: 0 }}>
                  {[...today].reverse().map((e, i, arr) => (
                    <li key={e.id} style={{ fontSize: 16, minHeight: 52, borderBottom: i === arr.length - 1 ? 0 : undefined }}>
                      <span>
                        {sourceName(bottles, e.bottleId)}{e.bottleId !== "other" && ` ${fractionLabel(e.fraction).toLowerCase()}`}
                        <span className="ink-list__meta" style={{ display: "block", marginTop: 4 }}>{TIME_FMT.format(new Date(e.at))}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="mono" style={{ fontSize: 15 }}>{fmt(e.oz, unit)}</span>
                        <button type="button" className="ink-btn ink-btn--ghost ink-btn--sm ink-btn--icon" aria-label={`Remove ${e.oz} oz entry`} onClick={() => removeEntry(e.id)}>{"✕"}</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {todayCoffees.length > 0 && (
              <section className="ink-card hidden lg:block">
                <div className="ink-card__head"><span>Coffee today</span><span className="ink-badge">{todayCoffees.length}</span></div>
                <ul className="ink-list" style={{ borderTop: 0 }}>
                  {[...todayCoffees].reverse().map((c, i, arr) => (
                    <li key={c.id} style={{ fontSize: 15, minHeight: 44, borderBottom: i === arr.length - 1 ? 0 : undefined }}>
                      <span>Coffee <span className="ink-list__meta">{TIME_FMT.format(new Date(c.at))}</span></span>
                      <button type="button" className="ink-btn ink-btn--ghost ink-btn--sm ink-btn--icon" aria-label="Remove coffee" onClick={() => removeCoffee(c.id)}>{"✕"}</button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </main>
    </Shell>
  );
}
