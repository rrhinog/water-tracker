import { describe, expect, it } from "vitest";
import { ACCENT_SWATCHES, accentReadable, contrast } from "./color";

describe("accent contrast", () => {
  it("computes WCAG contrast", () => {
    expect(contrast("#000000", "#ffffff")).toBe(21);
    expect(contrast("#ffffff", "#ffffff")).toBe(1);
  });

  it("every curated swatch passes 4.5:1 under white text", () => {
    for (const s of ACCENT_SWATCHES) expect(accentReadable(s.hex)).toBe(true);
  });

  it("refuses pastels and bad strings", () => {
    expect(accentReadable("#7dd3fc")).toBe(false); // sky-300
    expect(accentReadable("#ffcc00")).toBe(false);
    expect(accentReadable("blue")).toBe(false);
    expect(accentReadable("#fff")).toBe(false);
  });
});
