// User settings: the things that used to be hardcoded. Stored server-side (one JSON row)
// and cached locally; every device sees the same settings. Ounces are the storage unit
// everywhere; `unit` only changes what is shown and typed.
import { DEFAULT_ACCENT, accentReadable } from "./color";
import type { PaceMode } from "./pace";

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
};

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
  return { bottles: bottles.length ? bottles : DEFAULT_SETTINGS.bottles, floorOz, unit, paceStartH, paceEndH, defaultPaceMode, accent };
}

/** A stable id for a new bottle from its name (falls back to a random suffix on collision). */
export function bottleIdFor(name: string, existing: readonly Bottle[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "bottle";
  if (!existing.some((b) => b.id === base)) return base;
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export function bottleById(bottles: readonly Bottle[], id: string): Bottle | undefined {
  return bottles.find((b) => b.id === id);
}

/** Display name for an entry's source, even after its bottle was removed or renamed. */
export function sourceName(bottles: readonly Bottle[], source: string): string {
  if (source === "other") return "Other";
  return bottleById(bottles, source)?.name ?? source;
}
