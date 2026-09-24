import { describe, expect, it } from "vitest";
import { MAX_MESSAGE, MAX_STACK, buildPayload, createRateLimiter, parseReport } from "./clientErrors";

describe("buildPayload", () => {
  it("uses the Error's name, message and stack, and drops the query string", () => {
    const err = new TypeError("boom");
    const p = buildPayload(err, "fallback", "/settings?x=1#y");
    expect(p.message).toBe("TypeError: boom");
    expect(p.stack).toContain("boom");
    expect(p.path).toBe("/settings");
  });
  it("falls back for non-Error reasons and trims long stacks", () => {
    expect(buildPayload(undefined, "Unhandled promise rejection", "/").message).toBe("Unhandled promise rejection");
    expect(buildPayload("plain string", "fb", "/").message).toBe("plain string");
    const e = new Error("m");
    e.stack = "s".repeat(MAX_STACK * 3);
    expect(buildPayload(e, "", "/").stack).toHaveLength(MAX_STACK);
  });
});

describe("parseReport", () => {
  it("keeps only the known fields, trimmed", () => {
    const r = parseReport(JSON.stringify({ message: "m".repeat(MAX_MESSAGE + 50), stack: "s", path: "/a?b", email: "x@y.z" }), "UA");
    expect(r).toEqual({ message: "m".repeat(MAX_MESSAGE), stack: "s", path: "/a", ua: "UA" });
  });
  it("null for junk", () => {
    expect(parseReport("[]", null)).toBeNull();
    expect(parseReport("null", null)).toBeNull();
    expect(parseReport("{", null)).toBeNull();
  });
});

describe("createRateLimiter", () => {
  it("allows max per window and resets after it", () => {
    const allow = createRateLimiter(2, 1000);
    expect([allow(0), allow(10), allow(20)]).toEqual([true, true, false]);
    expect(allow(1000)).toBe(true);
  });
});
