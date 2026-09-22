// Accent colour helpers. The accent is the kit's ink-signal; white text sits on it, so it must
// pass WCAG 4.5:1 against white. Pure functions.

export const DEFAULT_ACCENT = "#111111";

/** Curated swatches: ink (the kit default) plus three that pass 4.5:1 under white. */
export const ACCENT_SWATCHES: readonly { hex: string; name: string }[] = [
  { hex: "#111111", name: "Ink" },
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

/** Can white label text sit on this accent? (WCAG AA for normal text.) */
export function accentReadable(hex: string): boolean {
  return isHex(hex) && contrast(hex, "#ffffff") >= 4.5;
}
