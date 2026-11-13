// User settings: the things that used to be hardcoded. Stored server-side (one JSON row)
// and cached locally; every device sees the same settings. Ounces are the storage unit
// everywhere; `unit` only changes what is shown and typed.
import { DEFAULT_ACCENT, accentReadable } from "./color";
import { dayKey } from "./log";
import type { PaceMode } from "./pace";
import { RETIRED_SETTINGS_KEYS } from "./retired";

export interface Bottle {
  id: string;
  name: string;
  oz: number;
}

export type Unit = "oz" | "ml";

export interface Settings {
  bottles: Bottle[];
  floorOz: number;
  unit: Unit;
  /** Local hours the "Even" pace spreads the floor across. */
  paceStartH: number;
  paceEndH: number;
  defaultPaceMode: PaceMode;
  /** The one accent colour (the kit's ink-signal), a #rrggbb that passes 4.5:1 under white. */
  accent: string;
  /** The daily steps floor, used only when a steps source is set up (STEPS_DATABASE_URL). */
  stepsFloor: number;
  /** YYYY-MM-DD the Floors count from; null = the last 30 days (src/lib/floors.ts). */
  floorsFrom: string | null;
}

/** First-run defaults (the author's setup). Change them in Settings, not here. */
export const DEFAULT_SETTINGS: Settings = {
  bottles: [
    { id: "owala", name: "Owala", oz: 40 },
    { id: "yeti", name: "Yeti", oz: 36 },
    { id: "camelbak", name: "CamelBak", oz: 50 },
  ],
  floorOz: 100,
  unit: "oz",
  paceStartH: 6,
  paceEndH: 21,
  defaultPaceMode: "history",
  accent: DEFAULT_ACCENT,
  stepsFloor: 10000,
  floorsFrom: null,
};

/** A real calendar day written YYYY-MM-DD (not 2026-02-30). */
export function isIsoDay(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d)) === s;
}

/**
 * The Floors' count-from date. A saved one wins, and a cleared one (null) stays cleared. A row saved
 * by 1.x has none: there the Floors counted from its Pact's Day 1, so that day is kept as the start
 * and the numbers on screen don't move on upgrade (docs/specs/split.md).
 */
function normalizeFloorsFrom(r: Record<string, unknown>): string | null {
  if (isIsoDay(r.floorsFrom)) return r.floorsFrom;
  if ("floorsFrom" in r) return null;
  const pact = r.pact as { start?: unknown } | null | undefined;
  return pact && typeof pact === "object" && isIsoDay(pact.start) ? pact.start : null;
}

export const ML_PER_OZ = 29.5735;

/** Storage oz -> display number in the chosen unit. */
export function toUnit(oz: number, unit: Unit): number {
  return unit === "ml" ? Math.round(oz * ML_PER_OZ) : Math.round(oz * 10) / 10;
}

/** Typed number in the chosen unit -> storage oz. */
export function fromUnit(value: number, unit: Unit): number {
  return unit === "ml" ? Math.round((value / ML_PER_OZ) * 10) / 10 : Math.round(value * 10) / 10;
}

export function fmt(oz: number, unit: Unit): string {
  return `${toUnit(oz, unit)} ${unit === "ml" ? "mL" : "oz"}`;
}

export function unitLabel(unit: Unit): string {
  return unit === "ml" ? "mL" : "oz";
}

/** Accept anything JSON-shaped and return a valid Settings, filling gaps from the defaults. */
export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  const bottles = Array.isArray(r.bottles)
    ? (r.bottles as unknown[])
        .map((b) => b as Partial<Bottle>)
        .filter((b) => typeof b.id === "string" && b.id.trim() && typeof b.name === "string" && typeof b.oz === "number" && b.oz > 0)
        .map((b) => ({ id: b.id!.trim(), name: b.name!.trim() || b.id!.trim(), oz: Math.round(b.oz! * 10) / 10 }))
    : DEFAULT_SETTINGS.bottles;
  const floorOz = typeof r.floorOz === "number" && r.floorOz > 0 ? Math.round(r.floorOz * 10) / 10 : DEFAULT_SETTINGS.floorOz;
  const unit: Unit = r.unit === "ml" ? "ml" : "oz";
  let paceStartH = typeof r.paceStartH === "number" ? Math.min(23, Math.max(0, Math.round(r.paceStartH))) : DEFAULT_SETTINGS.paceStartH;
  let paceEndH = typeof r.paceEndH === "number" ? Math.min(24, Math.max(1, Math.round(r.paceEndH))) : DEFAULT_SETTINGS.paceEndH;
  if (paceEndH <= paceStartH) {
    paceStartH = DEFAULT_SETTINGS.paceStartH;
    paceEndH = DEFAULT_SETTINGS.paceEndH;
  }
  const defaultPaceMode: PaceMode = r.defaultPaceMode === "even" ? "even" : "history";
  const accent = typeof r.accent === "string" && accentReadable(r.accent.toLowerCase()) ? r.accent.toLowerCase() : DEFAULT_ACCENT;
  const stepsFloor = typeof r.stepsFloor === "number" && r.stepsFloor >= 1 ? Math.round(r.stepsFloor) : DEFAULT_SETTINGS.stepsFloor;
  const floorsFrom = normalizeFloorsFrom(r as Record<string, unknown>);
  return { bottles: bottles.length ? bottles : DEFAULT_SETTINGS.bottles, floorOz, unit, paceStartH, paceEndH, defaultPaceMode, accent, stepsFloor, floorsFrom };
}

/**
 * The settings row to store when Settings is saved: the body, normalized, plus the fields 1.x kept in
 * the same row (flavours, vices, pact) copied from what is stored now, never from the body. Save
 * replaces the whole row, so without this a save in 2.0 would drop them and a rollback to 1.9.1 would
 * come back without them. A key the stored row doesn't have stays absent. Removed in 2.1.
 *
 * A body with no floorsFrom at all (a 1.9.1 tab still open after the update) keeps the stored date,
 * so it can't reset one chosen in 2.0.
 */
export function settingsForSave(body: unknown, stored: unknown): Record<string, unknown> {
  const next: Record<string, unknown> = { ...normalizeSettings(body) };
  const asObject = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const old = asObject(stored);
  for (const k of RETIRED_SETTINGS_KEYS) if (Object.hasOwn(old, k)) next[k] = old[k];
  if (!Object.hasOwn(asObject(body), "floorsFrom") && Object.hasOwn(old, "floorsFrom")) next.floorsFrom = normalizeSettings(old).floorsFrom;
  return next;
}

/** A stable id for a new bottle from its name (falls back to a random suffix on collision). */
export function bottleIdFor(name: string, existing: readonly Bottle[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "bottle";
  if (!existing.some((b) => b.id === base)) return base;
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

/** What blocks Save in the Floors card, in words; empty when the draft is fine. */
export function floorsProblems(s: Pick<Settings, "stepsFloor" | "floorsFrom">): string[] {
  const out: string[] = [];
  if (!(s.stepsFloor >= 1)) out.push("Steps floor must be at least 1");
  if (s.floorsFrom !== null && !isIsoDay(s.floorsFrom)) out.push("Pick a real count-from date");
  return out;
}

export function bottleById(bottles: readonly Bottle[], id: string): Bottle | undefined {
  return bottles.find((b) => b.id === id);
}

/** Display name for an entry's source, even after its bottle was removed or renamed. */
export function sourceName(bottles: readonly Bottle[], source: string): string {
  if (source === "other") return "Other";
  return bottleById(bottles, source)?.name ?? source;
}
