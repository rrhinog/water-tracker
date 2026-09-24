import { describe, expect, it } from "vitest";
import { appEnv, appNames } from "./appenv";

describe("appEnv", () => {
  it("is staging only for exactly 'staging'", () => {
    expect(appEnv("staging")).toBe("staging");
  });

  it("treats anything else as live, so a typo can never mark live as staging or the reverse", () => {
    for (const raw of [undefined, "", "live", "Staging", "STAGING", " staging", "staging ", "stage", "production", "demo"]) {
      expect(appEnv(raw)).toBe("live");
    }
  });
});

describe("appNames", () => {
  it("keeps live's names as they were", () => {
    expect(appNames("live")).toEqual({ name: "Water Tracker", shortName: "Water", title: "Water" });
  });

  it("labels the staging install and tab", () => {
    const n = appNames("staging");
    expect(n.shortName).toBe("Staging");
    expect(n.name).toContain("Staging");
    expect(n.title).toContain("Staging");
  });
});
