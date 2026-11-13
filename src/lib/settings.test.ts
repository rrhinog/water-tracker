import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, bottleIdFor, floorsProblems, fromUnit, normalizeSettings, settingsForSave, sourceName, toUnit } from "./settings";

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

describe("the Floors' settings", () => {
  it("the steps floor is a positive whole number, 10,000 by default", () => {
    expect(DEFAULT_SETTINGS.stepsFloor).toBe(10000);
    expect(normalizeSettings({ stepsFloor: 7500.6 }).stepsFloor).toBe(7501);
    expect(normalizeSettings({ stepsFloor: 0 }).stepsFloor).toBe(10000);
  });

  it("a fresh install has no count-from date: the Floors use the last 30 days", () => {
    expect(DEFAULT_SETTINGS.floorsFrom).toBeNull();
    expect(normalizeSettings({}).floorsFrom).toBeNull();
  });

  it("keeps a real count-from date, and a cleared one stays cleared", () => {
    expect(normalizeSettings({ floorsFrom: "2026-03-01" }).floorsFrom).toBe("2026-03-01");
    expect(normalizeSettings({ floorsFrom: null, pact: { start: "2026-03-01" } }).floorsFrom).toBeNull();
    expect(normalizeSettings({ floorsFrom: "2026-02-30" }).floorsFrom).toBeNull();
  });

  it("a row saved by 1.x starts the Floors where its Pact's Day 1 was, so the numbers don't move", () => {
    const from1x = { floorOz: 100, pact: { name: "Demo", start: "2026-03-01", days: 100, quits: ["coffee"] }, vices: [] };
    expect(normalizeSettings(from1x).floorsFrom).toBe("2026-03-01");
    expect(normalizeSettings({ pact: { start: "soon" } }).floorsFrom).toBeNull();
    expect(normalizeSettings({ pact: null }).floorsFrom).toBeNull();
  });

  it("says what blocks Save", () => {
    expect(floorsProblems({ stepsFloor: 10000, floorsFrom: null })).toEqual([]);
    expect(floorsProblems({ stepsFloor: 10000, floorsFrom: "2026-03-01" })).toEqual([]);
    expect(floorsProblems({ stepsFloor: 0, floorsFrom: "" })).toEqual(["Steps floor must be at least 1", "Pick a real count-from date"]);
  });

  it("2.0 settings carry no 1.x fields of their own", () => {
    const s = normalizeSettings({ flavours: ["A"], vices: [{ id: "a", name: "A", chips: [] }], pact: { start: "2026-03-01" } }) as unknown as Record<string, unknown>;
    expect(Object.keys(s).sort()).toEqual(["accent", "bottles", "defaultPaceMode", "floorOz", "floorsFrom", "paceEndH", "paceStartH", "stepsFloor", "unit"]);
  });
});

// Trap 1 of the split (docs/specs/split.md): Save replaces the whole settings row. If a save in 2.0
// dropped the fields only 1.x reads, rolling back to 1.9.1 would come back with no vices and no Pact.
describe("a Settings save carries the 1.x fields through untouched", () => {
  const stored1x = {
    bottles: [{ id: "yeti", name: "Yeti", oz: 36 }], floorOz: 100, unit: "oz", paceStartH: 6, paceEndH: 21, defaultPaceMode: "history", accent: "#111111", stepsFloor: 10000,
    flavours: ["Demo roast", "Bought out"],
    vices: [{ id: "sweets", name: "Sweets", chips: ["Candy", "Soda"], cleanSince: "2026-03-01" }],
    pact: { name: "Demo pact", start: "2026-03-01", days: 100, quits: ["sweets", "coffee"] },
  };

  it("keeps flavours, vices and pact exactly as stored, while the health fields change", () => {
    const body = { ...normalizeSettings(stored1x), floorOz: 120, floorsFrom: "2026-03-08" };
    const saved = settingsForSave(body, stored1x);
    expect(saved.floorOz).toBe(120);
    expect(saved.floorsFrom).toBe("2026-03-08");
    expect(saved.flavours).toEqual(stored1x.flavours);
    expect(saved.vices).toEqual(stored1x.vices);
    expect(saved.pact).toEqual(stored1x.pact);
    // Character for character, so a before/after comparison of the stored text matches.
    expect(JSON.stringify(saved.vices)).toBe(JSON.stringify(stored1x.vices));
    expect(JSON.stringify(saved.pact)).toBe(JSON.stringify(stored1x.pact));
  });

  it("1.9.1 reading the saved row still finds its vices and Pact", () => {
    const saved = settingsForSave({ ...normalizeSettings(stored1x), unit: "ml" }, stored1x) as typeof stored1x;
    expect(saved.vices.map((v) => v.id)).toEqual(["sweets"]);
    expect(saved.pact.quits).toEqual(["sweets", "coffee"]);
  });

  it("never takes those fields from the body: an old open tab can't overwrite them", () => {
    const saved = settingsForSave({ ...stored1x, vices: [], pact: null, flavours: [] }, stored1x);
    expect(saved.vices).toEqual(stored1x.vices);
    expect(saved.pact).toEqual(stored1x.pact);
    expect(saved.flavours).toEqual(stored1x.flavours);
  });

  it("a stored null Pact stays null; a field the row never had stays absent", () => {
    const saved = settingsForSave({}, { flavours: ["A"], pact: null });
    expect(saved.pact).toBeNull();
    expect(Object.hasOwn(saved, "vices")).toBe(false);
    expect(Object.hasOwn(settingsForSave({ vices: [{ id: "a" }] }, undefined), "vices")).toBe(false);
  });

  it("a 1.9.1 tab still open after the update can't reset a count-from date chosen in 2.0", () => {
    const stored2x = { ...stored1x, floorsFrom: "2026-03-08" };
    const fromOldTab = { ...stored1x, floorOz: 90 }; // 1.9.1 sends its whole Settings, with no floorsFrom
    const saved = settingsForSave(fromOldTab, stored2x);
    expect(saved.floorsFrom).toBe("2026-03-08");
    expect(saved.floorOz).toBe(90);
    expect(settingsForSave({ ...fromOldTab, floorsFrom: null }, stored2x).floorsFrom).toBeNull(); // 2.0 clearing it still works
  });

  it("several saves in a row still carry them", () => {
    let row: Record<string, unknown> = stored1x;
    for (const floorOz of [90, 110, 100]) row = settingsForSave({ ...normalizeSettings(row), floorOz }, row);
    expect(row.vices).toEqual(stored1x.vices);
    expect(row.pact).toEqual(stored1x.pact);
    expect(row.flavours).toEqual(stored1x.flavours);
  });
});
