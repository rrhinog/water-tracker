// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/client-errors", { method: "POST", body, headers: { "user-agent": "TestBrowser/1.0", ...headers } });
const report = (message = "TypeError: x is undefined") => JSON.stringify({ message, stack: "at a (b.js:1:2)", path: "/history?month=2026-09" });

// The limiter lives at module scope, so each test gets a fresh copy of the route.
async function freshRoute() {
  vi.resetModules();
  return (await import("./route")).POST;
}

let logged: string[];
beforeEach(() => {
  logged = [];
  vi.spyOn(console, "error").mockImplementation((line: string) => void logged.push(line));
});

describe("POST /api/client-errors", () => {
  it("logs one trimmed line and answers 204", async () => {
    const POST = await freshRoute();
    const res = await POST(post(report()));
    expect(res.status).toBe(204);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatch(/^\[client-error\] /);
    const line = JSON.parse(logged[0].replace("[client-error] ", ""));
    expect(line).toEqual({ message: "TypeError: x is undefined", stack: "at a (b.js:1:2)", path: "/history", ua: "TestBrowser/1.0" });
  });

  it("ignores a body over 8 KB without logging", async () => {
    const POST = await freshRoute();
    const big = JSON.stringify({ message: "x", stack: "y".repeat(9000) });
    expect((await POST(post(big))).status).toBe(413);
    expect((await POST(post("{}", { "content-length": "9000" }))).status).toBe(413);
    expect(logged).toHaveLength(0);
  });

  it("accepts 20 a minute, then drops the rest", async () => {
    const POST = await freshRoute();
    const statuses: number[] = [];
    for (let i = 0; i < 25; i++) statuses.push((await POST(post(report(`E${i}`)))).status);
    expect(statuses.filter((s) => s === 204)).toHaveLength(20);
    expect(statuses.slice(20)).toEqual([429, 429, 429, 429, 429]);
    expect(logged).toHaveLength(20);
  });

  it("400 for something that is not a report", async () => {
    const POST = await freshRoute();
    expect((await POST(post("not json"))).status).toBe(400);
    expect((await POST(post(JSON.stringify({ stack: "no message" })))).status).toBe(400);
    expect(logged).toHaveLength(0);
  });
});
