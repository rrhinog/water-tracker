// Browser-only persistence (localStorage). Roadmap item 6 replaces this with Postgres.
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from "./settings";
import { DEFAULT_DISPLAY, DISPLAY_KEY, parseDisplay, type DisplayStep } from "./display";
import type { CoffeeEntry } from "./coffee";
import type { Entry } from "./log";
import type { Slip, StepsDay } from "./vices";
import type { PaceMode } from "./pace";

const ENTRIES_KEY = "water.entries.v1";
const BOTTLE_KEY = "water.bottle.v1";
const PACE_KEY = "water.pace.v1";
const COFFEE_KEY = "water.coffee.v1";
const SETTINGS_KEY = "water.settings.v1";
const SLIPS_KEY = "water.slips.v1";
const STEPS_KEY = "water.steps.v1";

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

// null means this device never picked a mode, so Today uses Settings' default pace mode.
export function loadPaceMode(): PaceMode | null {
  if (!canStore()) return null;
  try {
    const v = window.localStorage.getItem(PACE_KEY);
    return v === "even" || v === "history" ? v : null;
  } catch {
    return null;
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

export function loadSlips(): Slip[] {
  if (!canStore()) return [];
  try {
    const raw = window.localStorage.getItem(SLIPS_KEY);
    return raw ? (JSON.parse(raw) as Slip[]) : [];
  } catch {
    return [];
  }
}

export function saveSlips(slips: readonly Slip[]): void {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(SLIPS_KEY, JSON.stringify(slips));
  } catch {
    // ignore
  }
}

/** The last steps the server sent, so the card can still say "as of" while offline. */
export function loadSteps(): StepsDay[] {
  if (!canStore()) return [];
  try {
    const raw = window.localStorage.getItem(STEPS_KEY);
    return raw ? (JSON.parse(raw) as StepsDay[]) : [];
  } catch {
    return [];
  }
}

export function saveSteps(rows: readonly StepsDay[]): void {
  if (!canStore()) return;
  try {
    if (rows.length) window.localStorage.setItem(STEPS_KEY, JSON.stringify(rows));
    else window.localStorage.removeItem(STEPS_KEY);
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

// Display size is per device on purpose: never sent to the server, never part of Settings' Save bar.
export function loadDisplay(): DisplayStep {
  if (!canStore()) return DEFAULT_DISPLAY;
  try {
    return parseDisplay(window.localStorage.getItem(DISPLAY_KEY));
  } catch {
    return DEFAULT_DISPLAY;
  }
}

export function saveDisplay(step: DisplayStep): void {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(DISPLAY_KEY, String(step));
  } catch {
    // ignore: the size still applies for this session
  }
}
