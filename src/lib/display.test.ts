import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_DISPLAY, DISPLAY_KEY, DISPLAY_STEPS, applyDisplay, displayScale, displayScript, isDisplayStep, parseDisplay } from "./display";

describe("display steps", () => {
  it("offers five sizes, smallest first, with the default among them", () => {
    expect(DISPLAY_STEPS).toEqual([80, 90, 100, 110, 125]);
    expect(DISPLAY_STEPS).toContain(DEFAULT_DISPLAY);
    expect(DEFAULT_DISPLAY).toBe(90); // v1.7.1: pinned so a change is deliberate
  });

  it("recognises only exact steps", () => {
    expect(isDisplayStep(90)).toBe(true);
    expect(isDisplayStep(95)).toBe(false);
    expect(isDisplayStep("90")).toBe(false);
  });

  it("scales by the step as a fraction", () => {
    expect(displayScale(80)).toBe(0.8);
    expect(displayScale(125)).toBe(1.25);
  });
});

describe("parseDisplay", () => {
  it("reads a stored step", () => {
    expect(parseDisplay("80")).toBe(80);
    expect(parseDisplay("125")).toBe(125);
  });

  it("falls back to the default for nothing, junk, or a value between steps", () => {
    for (const raw of [null, undefined, "", "  ", "huge", "95", "0", "-80", "1000", "NaN", "Infinity"]) {
      expect(parseDisplay(raw)).toBe(DEFAULT_DISPLAY);
    }
  });
});

describe("applying the size", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("style");
    window.localStorage.clear();
  });
  const scale = () => document.documentElement.style.getPropertyValue("--display-scale");

  it("applyDisplay puts the scale on <html>", () => {
    applyDisplay(90);
    expect(scale()).toBe("0.9");
  });

  // The head script is a string built from the same constants; run it to prove it agrees.
  const runScript = () => new Function(displayScript())();

  it("the head script applies a stored step", () => {
    window.localStorage.setItem(DISPLAY_KEY, "110");
    runScript();
    expect(scale()).toBe("1.1");
  });

  it("the head script uses the default when nothing or junk is stored, like parseDisplay", () => {
    runScript();
    expect(scale()).toBe(String(DEFAULT_DISPLAY / 100));
    window.localStorage.setItem(DISPLAY_KEY, "95");
    runScript();
    expect(scale()).toBe(String(DEFAULT_DISPLAY / 100));
  });

  it("the head script never throws, even when storage does", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    Object.defineProperty(window, "localStorage", { configurable: true, get: () => { throw new Error("blocked"); } });
    try {
      expect(runScript).not.toThrow();
    } finally {
      Object.defineProperty(window, "localStorage", original);
    }
  });
});
