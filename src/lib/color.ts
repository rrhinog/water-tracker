// Accent colour helpers. The accent is the kit's ink-signal; white text sits on it, so it must
// pass WCAG 4.5:1 against white. Pure functions.

export const DEFAULT_ACCENT = "#111111";

/**
 * Named themes: a light and a dark shade for water, plus a coffee colour, chosen as a set and
 * switched by the browser's light/dark mode (see globals.css, :root[data-accent]). Stored in
 * Settings by id instead of a hex. Every shade is contrast-checked in its role:
 *   light: Tide #1c6fa3 buttons (5.45:1 white text), Deep water #155a86 cleared (7.4:1),
 *          Mocha #7a4a2b coffee (7.39:1 white text)
 *   dark:  Sky #7cc7e8 (9.82:1 on #141414), Shell tan #d9a55b coffee (8.32:1)
 */
export const THEMES = {
  squirtle: { name: "Squirtle", light: "#1c6fa3", dark: "#7cc7e8" },
} as const;
export type ThemeId = keyof typeof THEMES;

export function isTheme(s: string): s is ThemeId {
  return Object.prototype.hasOwnProperty.call(THEMES, s);
}

/** Curated swatches: ink (the kit default), the Squirtle theme, and three hexes that pass 4.5:1 under white. */
export const ACCENT_SWATCHES: readonly { hex: string; name: string; preview?: string }[] = [
  { hex: "#111111", name: "Ink" },
  { hex: "squirtle", name: "Squirtle", preview: "linear-gradient(135deg, #1c6fa3 50%, #7cc7e8 50%)" },
  { hex: "#0f6e8c", name: "Deep teal" },
  { hex: "#2d6a4f", name: "Forest" },
  { hex: "#b23a48", name: "Brick" },
];

export function isHex(s: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(s);
}

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** WCAG contrast ratio between two hex colours. */
export function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/** Can white label text sit on this accent? (WCAG AA for normal text.) A named theme is pre-checked. */
export function accentReadable(hex: string): boolean {
  return isTheme(hex) || (isHex(hex) && contrast(hex, "#ffffff") >= 4.5);
}
