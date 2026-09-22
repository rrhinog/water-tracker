// Browser-only persistence (localStorage). Roadmap item 6 replaces this with Postgres.
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from "./settings";
import type { CoffeeEntry } from "./coffee";
import type { Entry } from "./log";
import type { PaceMode } from "./pace";

const ENTRIES_KEY = "water.entries.v1";
const BOTTLE_KEY = "water.bottle.v1";
const PACE_KEY = "water.pace.v1";
const COFFEE_KEY = "water.coffee.v1";
const SETTINGS_KEY = "water.settings.v1";

function canStore(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadEntries(): Entry[] {
  if (!canStore()) return [];
  try {
    const raw = window.localStorage.getItem(ENTRIES_KEY);
    return raw ? (JSON.parse(raw) as Entry[]) : [];
  } catch {
    return [];
  }
}

export function saveEntries(entries: readonly Entry[]): void {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  } catch {
    // Private mode or quota: in-memory state still works for this session.
  }
}

export function loadBottle(): string | null {
  if (!canStore()) return null;
  try {
    return window.localStorage.getItem(BOTTLE_KEY);
  } catch {
    return null;
  }
}

export function saveBottle(id: string): void {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(BOTTLE_KEY, id);
  } catch {
    // ignore
  }
}

export function loadPaceMode(): PaceMode {
  if (!canStore()) return "history";
  try {
    const v = window.localStorage.getItem(PACE_KEY);
    return v === "even" || v === "history" ? v : "history";
  } catch {
    return "history";
  }
}

export function savePaceMode(mode: PaceMode): void {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(PACE_KEY, mode);
  } catch {
    // ignore
  }
}

export function loadCoffee(): CoffeeEntry[] {
  if (!canStore()) return [];
  try {
    const raw = window.localStorage.getItem(COFFEE_KEY);
    return raw ? (JSON.parse(raw) as CoffeeEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveCoffee(entries: readonly CoffeeEntry[]): void {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(COFFEE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

export function loadSettings(): Settings {
  if (!canStore()) return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? normalizeSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}
