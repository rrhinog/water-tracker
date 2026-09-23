import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, bottleIdFor, fromUnit, normalizeSettings, sourceName, toUnit } from "./settings";

describe("units", () => {
  it("converts both ways and rounds sensibly", () => {
    expect(toUnit(36, "oz")).toBe(36);
    expect(toUnit(36, "ml")).toBe(1065);
    expect(fromUnit(1065, "ml")).toBe(36);
    expect(fromUnit(16.9, "oz")).toBe(16.9);
  });
});

describe("normalizeSettings", () => {
  it("returns the defaults for garbage", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings("nope")).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid values and repairs bad ones", () => {
    const s = normalizeSettings({
      bottles: [{ id: "nalgene", name: "Nalgene", oz: 32 }, { id: "", name: "bad", oz: 1 }, { id: "x", name: "neg", oz: -5 }],
      floorOz: 80,
      unit: "ml",
      paceStartH: 7,
      paceEndH: 22,
      defaultPaceMode: "even",
    });
    expect(s.bottles).toEqual([{ id: "nalgene", name: "Nalgene", oz: 32 }]);
    expect(s.floorOz).toBe(80);
    expect(s.unit).toBe("ml");
    expect(s.paceStartH).toBe(7);
    expect(s.paceEndH).toBe(22);
    expect(s.defaultPaceMode).toBe("even");
  });

  it("cleans the flavour list and keeps the defaults when absent", () => {
    expect(normalizeSettings({ flavours: [" Vanilla ", "", "Vanilla", 3, "Bought out"] }).flavours).toEqual(["Vanilla", "Bought out"]);
    expect(normalizeSettings({}).flavours).toEqual(DEFAULT_SETTINGS.flavours);
  });

  it("keeps a readable accent and falls back on an unreadable one", () => {
    expect(normalizeSettings({ accent: "#0F6E8C" }).accent).toBe("#0f6e8c");
    expect(normalizeSettings({ accent: "#7dd3fc" }).accent).toBe("#111111");
    expect(normalizeSettings({ accent: "red" }).accent).toBe("#111111");
  });

  it("falls back when the pace window is inverted or the bottle list is empty", () => {
    const s = normalizeSettings({ bottles: [], paceStartH: 20, paceEndH: 8 });
    expect(s.bottles).toEqual(DEFAULT_SETTINGS.bottles);
    expect(s.paceStartH).toBe(6);
    expect(s.paceEndH).toBe(21);
  });
});

describe("bottle helpers", () => {
  it("makes readable ids and avoids collisions", () => {
    expect(bottleIdFor("Hydro Flask 32", [])).toBe("hydro-flask-32");
    expect(bottleIdFor("Yeti", DEFAULT_SETTINGS.bottles)).toMatch(/^yeti-[a-z0-9]{4}$/);
  });

  it("names a source even after its bottle is gone", () => {
    expect(sourceName(DEFAULT_SETTINGS.bottles, "yeti")).toBe("Yeti");
    expect(sourceName([], "yeti")).toBe("yeti");
    expect(sourceName([], "other")).toBe("Other");
  });
});
