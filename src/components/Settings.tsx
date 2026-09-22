"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { ACCENT_SWATCHES, accentReadable, contrast, isHex } from "@/lib/color";
import { formatHour } from "@/lib/pace";
import { bottleIdFor, fromUnit, normalizeSettings, toUnit, unitLabel, type Bottle, type Settings as SettingsT, type Unit } from "@/lib/settings";
import { useSynced } from "@/lib/useSynced";

function same(a: SettingsT, b: SettingsT): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function Settings() {
  const { settings, updateSettings, sync, settingsSave, settingsSavedAt } = useSynced();
  // Edits build a draft; nothing is applied until Save.
  const [draft, setDraft] = useState<SettingsT>(settings);
  const [baseline, setBaseline] = useState<SettingsT>(settings);
  const [newName, setNewName] = useState("");
  const [newSize, setNewSize] = useState("");

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
  function discard() {
    setDraft(baseline);
    setNewName("");
    setNewSize("");
  }

  const hours = Array.from({ length: 24 }, (_, h) => h);
  const status =
    settingsSave === "saving" ? "Saving…"
      : settingsSave === "failed" ? "Saved on this device; server unreachable"
        : settingsSave === "saved" && settingsSavedAt ? `Saved ${settingsSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
          : sync === "offline" ? "Offline — showing this device's copy" : "";
  const accentOk = accentReadable(draft.accent);

  return (
    <Shell syncNote={sync === "offline" ? <span className="ink-tag">not synced</span> : null}>
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
                  onChange={(e) => setBottles(draft.bottles.map((x) => (x.id === b.id ? { ...x, oz: fromUnit(Number(e.target.value), unit) } : x)))} className="ink-input mono w-24 shrink-0 text-right" />
                <button type="button" className="ink-btn ink-btn--ghost ink-btn--sm ink-btn--icon" onClick={() => setBottles(draft.bottles.filter((x) => x.id !== b.id))} disabled={draft.bottles.length === 1} aria-label={`Remove ${b.name}`}>{"✕"}</button>
              </li>
            ))}
            <li style={{ minHeight: 56, padding: "8px 16px", gap: 8, borderBottom: 0 }}>
              <input aria-label="New container name" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} className="ink-input min-w-0 flex-1" />
              <input aria-label={`New container size in ${u}`} type="number" inputMode="decimal" min={0} placeholder={u} value={newSize} onChange={(e) => setNewSize(e.target.value)} className="ink-input mono w-24 shrink-0 text-right" />
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
          <div className="ink-card__head"><span>Colour</span><span className="mono" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-300)" }}>one accent</span></div>
          <div className="ink-card__body flex flex-col gap-3" style={{ padding: 16 }}>
            <div className="flex flex-wrap items-center gap-2.5" role="group" aria-label="Accent colour">
              {ACCENT_SWATCHES.map((s) => (
                <button key={s.hex} type="button" className="swatch" style={{ background: s.hex }} aria-label={s.name} aria-pressed={draft.accent === s.hex} onClick={() => patch({ accent: s.hex })} />
              ))}
              <label className="ml-auto flex items-center gap-2" style={{ font: "500 13px/1 var(--font-mono)", color: "var(--ink-700)" }}>
                custom
                <input type="color" value={isHex(draft.accent) ? draft.accent : "#111111"} onChange={(e) => patch({ accent: e.target.value.toLowerCase() })} aria-label="Custom accent" className="swatch" style={{ background: "transparent" }} />
              </label>
            </div>
            <div className="flex items-center gap-3">
              <span className="ink-btn ink-btn--primary ink-btn--sm" style={{ background: draft.accent, borderColor: draft.accent, pointerEvents: "none" }} aria-hidden="true">Log 36 oz</span>
              <span className="mono" style={{ font: "500 12px/1 var(--font-mono)", color: accentOk ? "var(--ink-700)" : "var(--ink-black)" }}>
                {isHex(draft.accent) ? `${draft.accent} · ${contrast(draft.accent, "#ffffff")}:1 on white${accentOk ? "" : " — too light for white text"}` : "not a colour"}
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

        {/* Sticky action bar: the one place changes are committed. Sits above the phone tab bar. */}
        <div className="fixed inset-x-0 bottom-[76px] lg:bottom-0 lg:left-60" style={{ borderTop: "2px solid var(--ink-black)", background: "var(--ink-white)", padding: "12px 16px" }}>
          <div className="mx-auto flex max-w-md items-center justify-between gap-3 lg:max-w-3xl">
            <p className="mono" style={{ margin: 0, font: "500 13px/1.3 var(--font-mono)", color: "var(--ink-700)" }} aria-live="polite">
              {problems.length ? problems[0] : dirty ? "Unsaved changes" : status || "All changes saved"}
            </p>
            <div className="flex gap-2">
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
  return out;
}
