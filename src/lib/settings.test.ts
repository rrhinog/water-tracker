import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, bottleIdFor, fromUnit, normalizeSettings, sourceName, toUnit, viceIdFor, viceProblems } from "./settings";

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
    expect(normalizeSettings({ accent: "squirtle" }).accent).toBe("squirtle");
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

describe("vices and the Pact", () => {
  it("a fresh install has no vices and no Pact", () => {
    expect(DEFAULT_SETTINGS.vices).toEqual([]);
    expect(DEFAULT_SETTINGS.pact).toBeNull();
    expect(normalizeSettings({}).vices).toEqual([]);
    expect(normalizeSettings({}).pact).toBeNull();
  });

  it("cleans vices like flavours: trimmed, unique ids, unique chips, a real clean-since date", () => {
    const s = normalizeSettings({
      vices: [
        { id: " alcohol ", name: " Alcohol ", chips: [" Beer ", "", "Beer", 3, "Wine"], cleanSince: "2026-03-01" },
        { id: "alcohol", name: "Twice", chips: [] },
        { id: "sweets", name: "", chips: "nope", cleanSince: "2026-02-30" },
        { id: "coffee", name: "Coffee", chips: [] },
        { id: "", name: "No id", chips: [] },
        "junk",
      ],
    });
    expect(s.vices).toEqual([
      { id: "alcohol", name: "Alcohol", chips: ["Beer", "Wine"], cleanSince: "2026-03-01" },
      { id: "sweets", name: "sweets", chips: [] },
    ]);
  });

  it("keeps a valid Pact and drops quits that are neither coffee nor a vice", () => {
    const s = normalizeSettings({
      vices: [{ id: "alcohol", name: "Alcohol", chips: [] }],
      pact: { name: " 100 days ", start: "2026-03-01", days: 100.4, quits: ["alcohol", "coffee", "gone", "alcohol"] },
    });
    expect(s.pact).toEqual({ name: "100 days", start: "2026-03-01", days: 100, quits: ["alcohol", "coffee"] });
  });

  it("a Pact with no real start date is dropped; a bad length or name falls back", () => {
    expect(normalizeSettings({ pact: { start: "soon", days: 100, quits: ["coffee"] } }).pact).toBeNull();
    expect(normalizeSettings({ pact: { start: "2026-03-01", days: -3, quits: ["coffee"] } }).pact).toEqual({ name: "Pact", start: "2026-03-01", days: 100, quits: ["coffee"] });
  });

  it("the steps floor is a positive whole number, 10,000 by default", () => {
    expect(DEFAULT_SETTINGS.stepsFloor).toBe(10000);
    expect(normalizeSettings({ stepsFloor: 7500.6 }).stepsFloor).toBe(7501);
    expect(normalizeSettings({ stepsFloor: 0 }).stepsFloor).toBe(10000);
  });

  it("says what blocks Save in the Vices and Pact cards", () => {
    const ok = { vices: [{ id: "a", name: "Alcohol", chips: ["Beer"] }], pact: { name: "P", start: "2026-03-01", days: 100, quits: ["a"] }, stepsFloor: 10000 };
    expect(viceProblems(ok)).toEqual([]);
    expect(viceProblems({ ...ok, vices: [{ id: "a", name: " ", chips: [] }] })).toEqual(["Every vice needs a name"]);
    expect(viceProblems({ ...ok, vices: [{ id: "a", name: "Alcohol", chips: [] }, { id: "b", name: "alcohol ", chips: [] }] })).toEqual(["Vice names must be unique"]);
    expect(viceProblems({ ...ok, vices: [{ id: "a", name: "A", chips: ["Beer", " Beer", ""] }] })).toEqual(["Every chip needs a name", "A vice's chips must be unique"]);
    expect(viceProblems({ ...ok, vices: [{ id: "a", name: "A", chips: [], cleanSince: "" }] })).toEqual(["Pick a real clean-since date"]);
    expect(viceProblems({ ...ok, pact: { name: "", start: "", days: 0, quits: [] }, stepsFloor: 0 })).toEqual([
      "The Pact needs a name", "Pick the Pact's start date", "The Pact lasts 1 to 3650 days", "The Pact needs at least one quit", "Steps floor must be at least 1",
    ]);
  });

  it("makes readable vice ids and never reuses one, or coffee's", () => {
    expect(viceIdFor("Late-night snacks", [])).toBe("late-night-snacks");
    expect(viceIdFor("Alcohol", [{ id: "alcohol" }])).toMatch(/^alcohol-[a-z0-9]{4}$/);
    expect(viceIdFor("Coffee", [])).toMatch(/^coffee-[a-z0-9]{4}$/);
    expect(viceIdFor("!!!", [])).toBe("vice");
  });
});
