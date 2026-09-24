import { describe, expect, it } from "vitest";
import { isNewRelease } from "./health";

describe("isNewRelease", () => {
  it("a different version on the server means a new release is serving", () => {
    expect(isNewRelease("1.7.1+eebbbcf", "1.8.0+abc1234")).toBe(true);
    expect(isNewRelease("1.8.0+abc1234", "1.8.0+def5678")).toBe(true); // same number, new build
  });

  it("the same version, or an unknown one on either side, is never new", () => {
    expect(isNewRelease("1.8.0+abc1234", "1.8.0+abc1234")).toBe(false);
    expect(isNewRelease(undefined, "1.8.0")).toBe(false);
    expect(isNewRelease("1.8.0", null)).toBe(false);
    expect(isNewRelease("", "")).toBe(false);
  });
});
