// Display size: a per-device scale for the whole app (Settings → Display). Every size in the app is
// a fixed px value, so a base-font approach would move nothing; instead the root element gets CSS
// `zoom` from --display-scale (globals.css). Stored in localStorage only, never synced: a phone and
// a desktop can want different sizes.

/** The steps offered in Settings, in percent. */
export const DISPLAY_STEPS = [80, 90, 100, 110, 125] as const;
export type DisplayStep = (typeof DISPLAY_STEPS)[number];

/**
 * Size used until this device picks one. The one place to change the default.
 * 90 since v1.7.1: the Ink Kit sizes (fixed px, 34 px titles, 56 px totals) read large on a phone at 100.
 */
export const DEFAULT_DISPLAY: DisplayStep = 90;

export const DISPLAY_KEY = "water.display.v1";

export function isDisplayStep(n: unknown): n is DisplayStep {
  return typeof n === "number" && (DISPLAY_STEPS as readonly number[]).includes(n);
}

/** A stored value back to a step; anything that is not exactly a step gives the default. */
export function parseDisplay(raw: string | null | undefined): DisplayStep {
  if (raw == null || raw.trim() === "") return DEFAULT_DISPLAY;
  const n = Number(raw);
  return isDisplayStep(n) ? n : DEFAULT_DISPLAY;
}

/** The value the CSS multiplies by: 90 → 0.9. */
export function displayScale(step: DisplayStep): number {
  return step / 100;
}

/** Puts a step on <html>. Callers: the Settings control (live preview) and DisplaySize (dev remount). */
export function applyDisplay(step: DisplayStep): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--display-scale", String(displayScale(step)));
}

/**
 * The inline <head> script (app/layout.tsx). It runs while the HTML is parsed, before first paint,
 * so a reload never shows 100% and then jumps. Same rules as parseDisplay, built from the same
 * constants; ES5 and self-contained because it runs before any bundle loads.
 */
export function displayScript(): string {
  return (
    "(function(){try{" +
    `var s=${JSON.stringify(DISPLAY_STEPS)},v=Number(localStorage.getItem(${JSON.stringify(DISPLAY_KEY)}));` +
    `if(s.indexOf(v)<0)v=${DEFAULT_DISPLAY};` +
    "document.documentElement.style.setProperty('--display-scale',String(v/100))" +
    "}catch(e){}})()"
  );
}
