"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { DISPLAY_STEPS, applyDisplay, type DisplayStep } from "@/lib/display";
import { ACCENT_SWATCHES, THEMES, accentReadable, contrast, isHex, isTheme } from "@/lib/color";
import { formatHour } from "@/lib/pace";
import { loadDisplay, saveDisplay } from "@/lib/storage";
import { dayKey } from "@/lib/log";
import { bottleIdFor, fromUnit, normalizeSettings, toUnit, unitLabel, viceIdFor, viceProblems, type Bottle, type Settings as SettingsT, type Unit, type Vice } from "@/lib/settings";
import { COFFEE_QUIT } from "@/lib/vices";
import { useSynced } from "@/lib/useSynced";

// Size boxes hold a few digits: they keep their on-screen width at large display sizes so the name gets the room.
const SIZE_BOX = { width: "min(96px, 96px / var(--display-scale))" };

function same(a: SettingsT, b: SettingsT): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function Settings() {
  const { settings, updateSettings, sync, offline, settingsSave, settingsSavedAt } = useSynced();
  // Edits build a draft; nothing is applied until Save.
  const [draft, setDraft] = useState<SettingsT>(settings);
  const [baseline, setBaseline] = useState<SettingsT>(settings);
  const [newName, setNewName] = useState("");
  const [newSize, setNewSize] = useState("");
  const [newFlavour, setNewFlavour] = useState("");
  const [newVice, setNewVice] = useState("");
  // The "add a chip" box under each vice, by vice id.
  const [newChip, setNewChip] = useState<Record<string, string>>({});
  // Display size is per device and applies on tap: outside the draft, so the Save bar never sees it.
  const [display, setDisplay] = useState<DisplayStep>(loadDisplay);

  // Adopt a server/other-device copy unless the user is mid-edit (React's adjust-on-prop-change pattern).
  const [seen, setSeen] = useState<SettingsT>(settings);
  if (settings !== seen) {
    setSeen(settings);
    if (same(draft, baseline) && !same(settings, baseline)) {
      setDraft(settings);
      setBaseline(settings);
    }
  }

  const dirty = !same(draft, baseline);
  const problems = validate(draft);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const unit = draft.unit;
  const u = unitLabel(unit);
  const patch = (p: Partial<SettingsT>) => setDraft({ ...draft, ...p });
  const setBottles = (bottles: Bottle[]) => patch({ bottles });
  const setVice = (id: string, p: Partial<Vice>) => patch({ vices: draft.vices.map((v) => (v.id === id ? { ...v, ...p } : v)) });

  function addVice() {
    const name = newVice.trim();
    if (!name) return;
    patch({ vices: [...draft.vices, { id: viceIdFor(name, draft.vices), name, chips: [] }] });
    setNewVice("");
  }
  function removeVice(id: string) {
    // A Pact that covered it stops covering it; its slips stay on record.
    patch({ vices: draft.vices.filter((v) => v.id !== id), pact: draft.pact && { ...draft.pact, quits: draft.pact.quits.filter((q) => q !== id) } });
  }
  function setCleanSince(id: string, value: string) {
    const rest = draft.vices.map((v) => {
      if (v.id !== id) return v;
      const { cleanSince: _old, ...without } = v;
      void _old;
      return value ? { ...without, cleanSince: value } : without;
    });
    patch({ vices: rest });
  }
  function addChip(v: Vice) {
    const chip = (newChip[v.id] ?? "").trim();
    if (!chip) return;
    setVice(v.id, { chips: [...v.chips, chip] });
    setNewChip({ ...newChip, [v.id]: "" });
  }
  function toggleQuit(id: string) {
    if (!draft.pact) return;
    const quits = draft.pact.quits.includes(id) ? draft.pact.quits.filter((q) => q !== id) : [...draft.pact.quits, id];
    patch({ pact: { ...draft.pact, quits } });
  }

  function addBottle() {
    const size = Number(newSize);
    if (!newName.trim() || !(size > 0)) return;
    setBottles([...draft.bottles, { id: bottleIdFor(newName, draft.bottles), name: newName.trim(), oz: fromUnit(size, unit) }]);
    setNewName("");
    setNewSize("");
  }
  function save() {
    if (!dirty || problems.length) return;
    const clean = normalizeSettings(draft);
    updateSettings(clean);
    setDraft(clean);
    setBaseline(clean);
  }
  function pickDisplay(step: DisplayStep) {
    setDisplay(step);
    saveDisplay(step);
    applyDisplay(step);
  }
  function discard() {
    setDraft(baseline);
    setNewName("");
    setNewSize("");
    setNewVice("");
    setNewChip({});
  }

  const hours = Array.from({ length: 24 }, (_, h) => h);
  const status =
    settingsSave === "saving" ? "Saving…"
      : settingsSave === "failed" ? "Saved on this device; server unreachable"
        : settingsSave === "saved" && settingsSavedAt ? `Saved ${settingsSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
          : sync === "offline" ? "Offline — showing this device's copy" : "";
  const accentOk = accentReadable(draft.accent);
  const previewHex = isTheme(draft.accent) ? THEMES[draft.accent].light : draft.accent;

  return (
    <Shell offline={offline}>
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-24 lg:max-w-3xl lg:gap-6 lg:p-10 lg:pb-28">
        <header className="flex flex-col gap-1">
          <span className="eyebrow">Water</span>
          <h1 style={{ margin: 0, font: "800 34px/1 var(--font-sans)", letterSpacing: "-0.03em" }}>Settings</h1>
        </header>

        <section className="ink-card">
          <div className="ink-card__head"><span>Containers</span><span className="mono" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-300)" }}>{u}</span></div>
          <ul className="ink-list" style={{ borderTop: 0 }}>
            {draft.bottles.map((b) => (
              <li key={b.id} style={{ minHeight: 56, padding: "8px 16px", gap: 8 }}>
                <input aria-label={`Name of ${b.name}`} value={b.name} onChange={(e) => setBottles(draft.bottles.map((x) => (x.id === b.id ? { ...x, name: e.target.value } : x)))} className="ink-input min-w-0 flex-1" />
                <input aria-label={`Size of ${b.name} in ${u}`} type="number" inputMode="decimal" min={0} value={toUnit(b.oz, unit)}
                  onChange={(e) => setBottles(draft.bottles.map((x) => (x.id === b.id ? { ...x, oz: fromUnit(Number(e.target.value), unit) } : x)))} className="ink-input mono shrink-0 text-right" style={SIZE_BOX} />
                <button type="button" className="ink-btn ink-btn--ghost ink-btn--sm ink-btn--icon" onClick={() => setBottles(draft.bottles.filter((x) => x.id !== b.id))} disabled={draft.bottles.length === 1} aria-label={`Remove ${b.name}`}>{"✕"}</button>
              </li>
            ))}
            <li style={{ minHeight: 56, padding: "8px 16px", gap: 8, borderBottom: 0 }}>
              <input aria-label="New container name" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} className="ink-input min-w-0 flex-1" />
              <input aria-label={`New container size in ${u}`} type="number" inputMode="decimal" min={0} placeholder={u} value={newSize} onChange={(e) => setNewSize(e.target.value)} className="ink-input mono shrink-0 text-right" style={SIZE_BOX} />
              <button type="button" className="ink-btn" onClick={addBottle} disabled={!newName.trim() || !(Number(newSize) > 0)}>Add</button>
            </li>
          </ul>
          <p style={{ margin: 0, padding: "10px 16px 14px", font: "400 13px/1.5 var(--font-sans)", color: "var(--ink-700)" }}>Past entries keep the amount they were logged with, whatever you change here.</p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">Daily floor ({u})</span>
            <input type="number" inputMode="decimal" min={1} value={toUnit(draft.floorOz, unit)} onChange={(e) => patch({ floorOz: fromUnit(Number(e.target.value), unit) })} className="ink-input mono w-full" />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">Units</span>
            <div className="flex gap-1.5" role="group" aria-label="Units">
              {(["oz", "ml"] as const).map((x: Unit) => (
                <button key={x} type="button" className="ink-chip flex-1 justify-center" style={{ height: 40 }} aria-pressed={unit === x} onClick={() => patch({ unit: x })}>{unitLabel(x)}</button>
              ))}
            </div>
          </div>
        </div>

        <section className="ink-card">
          <div className="ink-card__head"><span>Flavours</span><span className="mono" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-300)" }}>coffee</span></div>
          <ul className="ink-list" style={{ borderTop: 0 }}>
            {draft.flavours.map((f, i) => (
              <li key={i} style={{ minHeight: 56, padding: "8px 16px", gap: 8 }}>
                <input aria-label={`Flavour ${i + 1}`} value={f} onChange={(e) => patch({ flavours: draft.flavours.map((x, j) => (j === i ? e.target.value : x)) })} className="ink-input min-w-0 flex-1" />
                <button type="button" className="ink-btn ink-btn--ghost ink-btn--sm ink-btn--icon" onClick={() => patch({ flavours: draft.flavours.filter((_, j) => j !== i) })} aria-label={`Remove flavour ${f}`}>{"✕"}</button>
              </li>
            ))}
            <li style={{ minHeight: 56, padding: "8px 16px", gap: 8, borderBottom: 0 }}>
              <input aria-label="New flavour" placeholder="Pod or place" value={newFlavour} onChange={(e) => setNewFlavour(e.target.value)} className="ink-input min-w-0 flex-1" />
              <button type="button" className="ink-btn" disabled={!newFlavour.trim()} onClick={() => { patch({ flavours: [...draft.flavours, newFlavour.trim()] }); setNewFlavour(""); }}>Add</button>
            </li>
          </ul>
          <p style={{ margin: 0, padding: "10px 16px 14px", font: "400 13px/1.5 var(--font-sans)", color: "var(--ink-700)" }}>Logging a coffee uses your last flavour; change it on the open coffee. Past coffees keep the name they were logged with.</p>
        </section>

        <section className="ink-card" aria-label="Vices">
          <div className="ink-card__head"><span>Vices</span><span className="mono" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-300)" }}>{draft.vices.length ? `${draft.vices.length} tracked` : "off"}</span></div>
          {draft.vices.map((v) => (
            <div key={v.id} className="flex flex-col gap-2" style={{ padding: "12px 16px", borderBottom: "2px solid var(--ink-900)" }}>
              <div className="flex items-center gap-2">
                <input aria-label={`Name of vice ${v.name || v.id}`} value={v.name} onChange={(e) => setVice(v.id, { name: e.target.value })} className="ink-input min-w-0 flex-1" />
                <button type="button" className="ink-btn ink-btn--ghost ink-btn--sm ink-btn--icon" onClick={() => removeVice(v.id)} aria-label={`Remove vice ${v.name || v.id}`}>{"✕"}</button>
              </div>
              <label className="flex flex-wrap items-center gap-2" style={{ fontSize: 14, color: "var(--ink-700)" }}>
                clean since
                <input type="date" className="ink-input mono" style={{ width: 170 }} value={v.cleanSince ?? ""} max={dayKey(new Date())} onChange={(e) => setCleanSince(v.id, e.target.value)} aria-label={`Clean since (${v.name || v.id})`} />
              </label>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Chips for ${v.name || v.id}`}>
                {v.chips.map((c, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <input aria-label={`Chip ${i + 1} of ${v.name || v.id}`} value={c} onChange={(e) => setVice(v.id, { chips: v.chips.map((x, j) => (j === i ? e.target.value : x)) })} className="ink-input" style={{ width: "min(140px, 140px / var(--display-scale))", height: 36 }} />
                    <button type="button" className="ink-btn ink-btn--ghost ink-btn--sm ink-btn--icon" onClick={() => setVice(v.id, { chips: v.chips.filter((_, j) => j !== i) })} aria-label={`Remove chip ${c}`}>{"✕"}</button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input aria-label={`New chip for ${v.name || v.id}`} placeholder="What it can be (e.g. Beer)" value={newChip[v.id] ?? ""} onChange={(e) => setNewChip({ ...newChip, [v.id]: e.target.value })} className="ink-input min-w-0 flex-1" />
                <button type="button" className="ink-btn" disabled={!(newChip[v.id] ?? "").trim()} onClick={() => addChip(v)}>Add chip</button>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2" style={{ minHeight: 56, padding: "8px 16px" }}>
            <input aria-label="New vice" placeholder="Something to quit" value={newVice} onChange={(e) => setNewVice(e.target.value)} className="ink-input min-w-0 flex-1" />
            <button type="button" className="ink-btn" disabled={!newVice.trim()} onClick={addVice}>Add</button>
          </div>
          <p style={{ margin: 0, padding: "10px 16px 14px", font: "400 13px/1.5 var(--font-sans)", color: "var(--ink-700)" }}>Each vice gets a card on Today with a Slip button. Removing one keeps its slips on record.</p>
        </section>

        <section className="ink-card" aria-label="Pact">
          <div className="ink-card__head"><span>Pact</span><span className="mono" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-300)" }}>{draft.pact ? `${draft.pact.days} days` : "off"}</span></div>
          {draft.pact ? (
            <div className="ink-card__body flex flex-col gap-3" style={{ padding: 16 }}>
              <label className="flex flex-col gap-1.5"><span className="eyebrow">Name</span>
                <input value={draft.pact.name} onChange={(e) => patch({ pact: { ...draft.pact!, name: e.target.value } })} className="ink-input w-full" aria-label="Pact name" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex min-w-0 flex-col gap-1.5"><span className="eyebrow">Day 1</span>
                  <input type="date" value={draft.pact.start} onChange={(e) => patch({ pact: { ...draft.pact!, start: e.target.value } })} className="ink-input mono w-full" aria-label="Pact start" />
                </label>
                <label className="flex min-w-0 flex-col gap-1.5"><span className="eyebrow">Length (days)</span>
                  <input type="number" inputMode="numeric" min={1} max={3650} value={draft.pact.days} onChange={(e) => patch({ pact: { ...draft.pact!, days: Number(e.target.value) } })} className="ink-input mono w-full" aria-label="Pact length in days" />
                </label>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="eyebrow">Covers</span>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pact covers">
                  {[{ id: COFFEE_QUIT, name: "Coffee" }, ...draft.vices].map((q) => (
                    <button key={q.id} type="button" className="ink-chip" aria-pressed={draft.pact!.quits.includes(q.id)} onClick={() => toggleQuit(q.id)}>{q.name || q.id}</button>
                  ))}
                </div>
              </div>
              <label className="flex flex-col gap-1.5"><span className="eyebrow">Steps floor</span>
                <input type="number" inputMode="numeric" min={1} value={draft.stepsFloor} onChange={(e) => patch({ stepsFloor: Number(e.target.value) })} className="ink-input mono w-full" aria-label="Steps floor" />
              </label>
              <p style={{ margin: 0, font: "400 13px/1.5 var(--font-sans)", color: "var(--ink-700)" }}>A day is clean when none of the quits it covers happened. Steps show only when a steps source is set up.</p>
              <button type="button" className="ink-btn ink-btn--ghost" style={{ alignSelf: "flex-start" }} onClick={() => patch({ pact: null })}>Remove Pact</button>
            </div>
          ) : (
            <div className="ink-card__body flex flex-col gap-3" style={{ padding: 16 }}>
              <p style={{ margin: 0, font: "400 13px/1.5 var(--font-sans)", color: "var(--ink-700)" }}>A challenge over your quits, such as 100 days with no coffee: one clean-day score, with each quit underneath.</p>
              <button type="button" className="ink-btn" style={{ alignSelf: "flex-start" }}
                onClick={() => patch({ pact: { name: "Pact", start: dayKey(new Date()), days: 100, quits: [COFFEE_QUIT, ...draft.vices.map((v) => v.id)] } })}>Set up a Pact</button>
            </div>
          )}
        </section>

        <section className="ink-card">
          <div className="ink-card__head"><span>Colour</span><span className="mono" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-300)" }}>one accent</span></div>
          <div className="ink-card__body flex flex-col gap-3" style={{ padding: 16 }}>
            <div className="flex flex-wrap items-center gap-2.5" role="group" aria-label="Accent colour">
              {ACCENT_SWATCHES.map((s) => (
                <button key={s.hex} type="button" className="swatch" style={{ background: s.preview ?? s.hex }} aria-label={s.name} aria-pressed={draft.accent === s.hex} onClick={() => patch({ accent: s.hex })} />
              ))}
              <label className="ml-auto flex items-center gap-2" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-700)" }}>
                custom
                <input type="color" value={isHex(draft.accent) ? draft.accent : "#111111"} onChange={(e) => patch({ accent: e.target.value.toLowerCase() })} aria-label="Custom accent" className="swatch" style={{ background: "transparent" }} />
              </label>
            </div>
            <div className="flex items-center gap-3">
              <span className="ink-btn ink-btn--primary ink-btn--sm" style={{ background: previewHex, borderColor: previewHex, color: "#ffffff", pointerEvents: "none" }} aria-hidden="true">Log 36 oz</span>
              <span className="mono" style={{ font: "500 12px/1 var(--font-mono)", color: accentOk ? "var(--ink-700)" : "var(--ink-black)" }}>
                {isTheme(draft.accent) ? `${THEMES[draft.accent].name} · ${THEMES[draft.accent].light} light, ${THEMES[draft.accent].dark} dark` : isHex(draft.accent) ? `${draft.accent} · ${contrast(draft.accent, "#ffffff")}:1 on white${accentOk ? "" : " — too light for white text"}` : "not a colour"}
              </span>
            </div>
            <p style={{ margin: 0, font: "400 13px/1.5 var(--font-sans)", color: "var(--ink-700)" }}>Used for the Log button, active chips and tabs, and progress fills. Everything else stays ink.</p>
          </div>
        </section>

        <section className="ink-card">
          <div className="ink-card__head"><span>Pace</span><span className="mono" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-300)" }}>first bottle by {formatHour(Math.min(draft.paceEndH, draft.paceStartH + 4))}</span></div>
          <div className="ink-card__body flex flex-col gap-3" style={{ padding: 16 }}>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5"><span className="eyebrow">Day starts</span>
                <select value={draft.paceStartH} onChange={(e) => patch({ paceStartH: Number(e.target.value) })} className="ink-input w-full">
                  {hours.filter((h) => h < draft.paceEndH).map((h) => <option key={h} value={h}>{formatHour(h)}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5"><span className="eyebrow">Day ends</span>
                <select value={draft.paceEndH} onChange={(e) => patch({ paceEndH: Number(e.target.value) })} className="ink-input w-full">
                  {hours.filter((h) => h > draft.paceStartH).map((h) => <option key={h} value={h}>{formatHour(h)}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="eyebrow">Default mode</span>
              <div className="flex gap-1.5" role="group" aria-label="Default pace mode">
                {(["even", "history"] as const).map((m) => (
                  <button key={m} type="button" className="ink-chip flex-1 justify-center" style={{ height: 40 }} aria-pressed={draft.defaultPaceMode === m} onClick={() => patch({ defaultPaceMode: m })}>{m === "even" ? "Even" : "My history"}</button>
                ))}
              </div>
            </div>
            <p style={{ margin: 0, font: "400 13px/1.5 var(--font-sans)", color: "var(--ink-700)" }}>Even spreads the floor across the day. My history follows the shape of your own cleared days (a built-in curve stands in until you have 10).</p>
          </div>
        </section>

        <section className="ink-card">
          <div className="ink-card__head"><span>Display</span><span className="mono" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-300)" }}>This device only</span></div>
          <div className="ink-card__body flex flex-col gap-3" style={{ padding: 16 }}>
            <div className="flex flex-col gap-1.5">
              <span className="eyebrow">Size</span>
              <div className="flex gap-1.5" role="group" aria-label="Display size">
                {DISPLAY_STEPS.map((step) => (
                  <button key={step} type="button" className="ink-chip min-w-0 flex-1 justify-center" style={{ height: 40, padding: "0 4px" }} aria-pressed={display === step} onClick={() => pickDisplay(step)}>{step}%</button>
                ))}
              </div>
            </div>
            <p style={{ margin: 0, font: "400 13px/1.5 var(--font-sans)", color: "var(--ink-700)" }}>Scales the whole app. Applies right away and is kept on this device only; your phone and computer can differ.</p>
          </div>
        </section>

        {/* Sticky action bar: the one place changes are committed. Sits above the phone tab bar. */}
        <div className="fixed inset-x-0 bottom-[76px] lg:bottom-0 lg:left-60" style={{ borderTop: "2px solid var(--ink-black)", background: "var(--ink-white)", padding: "12px 16px" }}>
          {/* Wraps the message onto its own line only when the buttons need the width (large display sizes). */}
          <div className="mx-auto flex max-w-md flex-wrap items-center justify-between gap-x-3 gap-y-2 lg:max-w-3xl">
            <p className="mono" style={{ margin: 0, flex: "1 1 64px", minWidth: 0, overflowWrap: "anywhere", font: "500 13px/1.3 var(--font-mono)", color: "var(--ink-700)" }} aria-live="polite">
              {problems.length ? problems[0] : dirty ? "Unsaved changes" : status || "All changes saved"}
            </p>
            <div className="ml-auto flex gap-2">
              <button type="button" className="ink-btn ink-btn--ghost" onClick={discard} disabled={!dirty}>Discard</button>
              <button type="button" className="ink-btn ink-btn--primary" onClick={save} disabled={!dirty || problems.length > 0}>Save changes</button>
            </div>
          </div>
        </div>
      </main>
    </Shell>
  );
}

function validate(s: SettingsT): string[] {
  const out: string[] = [];
  if (s.bottles.some((b) => !b.name.trim())) out.push("Every container needs a name");
  if (s.bottles.some((b) => !(b.oz > 0))) out.push("Container sizes must be greater than 0");
  if (!(s.floorOz > 0)) out.push("Daily floor must be greater than 0");
  if (s.paceEndH <= s.paceStartH) out.push("The day must end after it starts");
  if (!accentReadable(s.accent)) out.push("Accent is too light for white text (needs 4.5:1)");
  if (s.flavours.some((f) => !f.trim())) out.push("Every flavour needs a name");
  if (new Set(s.flavours.map((f) => f.trim())).size !== s.flavours.length) out.push("Flavours must be unique");
  out.push(...viceProblems(s));
  return out;
}
