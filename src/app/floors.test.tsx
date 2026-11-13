import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
import History from "@/components/History";
import Settings from "@/components/Settings";
import Tracker from "@/components/Tracker";

// A fixed clock: Thu 24 Sep 2026, 2:30 PM local. Only Date is faked; timers stay real.
const NOW = new Date(2026, 8, 24, 14, 30);
const card = (name: string) => within(screen.getByRole("region", { name }));

// A server still holding what 1.x tracked: a settings row with flavours, vices and a Pact, and coffee
// and slip rows behind the old routes. All made up.
const SETTINGS_1X = {
  floorOz: 100,
  stepsFloor: 10000,
  flavours: ["Demo roast", "Bought out"],
  vices: [{ id: "sweets", name: "Sweets", chips: ["Candy", "Soda"], cleanSince: "2026-09-01" }],
  pact: { name: "Demo pact", start: "2026-09-21", days: 100, quits: ["sweets", "coffee"] },
};
const COFFEE_ROWS = [{ id: "c1", at: new Date(2026, 8, 24, 8).toISOString(), flavour: "Demo roast" }];
const SLIP_ROWS = [{ id: "s1", vice: "sweets", at: new Date(2026, 8, 23, 20).toISOString(), kind: "Candy" }];
const STEPS = [
  { day: "2026-09-22", steps: 4000, syncedAt: new Date(2026, 8, 23, 1).toISOString() },
  { day: "2026-09-23", steps: 12000, syncedAt: new Date(2026, 8, 24, 1).toISOString() },
  { day: "2026-09-24", steps: 8412, syncedAt: new Date(2026, 8, 24, 12, 0).toISOString() },
];

function server(settings: object = SETTINGS_1X, steps: object = { enabled: true, days: STEPS }) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const body =
      url === "/api/settings" ? settings
        : url === "/api/steps" ? steps
          : url === "/api/coffee" ? COFFEE_ROWS
            : url === "/api/slips" ? SLIP_ROWS
              : url === "/api/health" ? {} : [];
    return { ok: true, status: 200, json: async () => body };
  });
  vi.stubGlobal("fetch", fetch);
  return { calls, fetch };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// Words only 1.x's coffee, vice and Pact screens used, and the made-up data above.
// Whole words: "device" (the Display card) is fine, "vice" is not.
const RETIRED_WORDS = /(coffees?|coffee-free|slips?|vices?|pact|flavours?|sweets|candy)|clean since|demo roast|bought out/i;

describe("2.0 shows no coffee, vices or Pact, even when the server still has them", () => {
  it("Today", async () => {
    const { fetch } = server();
    render(<Tracker />);
    await screen.findByRole("region", { name: "Floors" });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/settings", expect.anything()));
    expect(document.body.textContent).not.toMatch(RETIRED_WORDS);
    expect(screen.queryByRole("button", { name: /coffee|slip/i })).toBeNull();
  });

  it("History", async () => {
    const { fetch } = server();
    render(<History />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/settings", expect.anything()));
    expect(document.body.textContent).not.toMatch(RETIRED_WORDS);
  });

  it("Settings", async () => {
    const { fetch } = server();
    render(<Settings />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/settings", expect.anything()));
    await screen.findByRole("region", { name: "Floors" });
    expect(document.body.textContent).not.toMatch(RETIRED_WORDS);
    expect(screen.queryByRole("region", { name: /vices|pact/i })).toBeNull();
  });

  it("2.0 never asks the old coffee or slip routes for their rows", async () => {
    const { calls } = server();
    render(<Tracker />);
    await screen.findByRole("region", { name: "Floors" });
    await waitFor(() => expect(calls.some((c) => c.url === "/api/settings")).toBe(true));
    expect(calls.filter((c) => c.url === "/api/coffee" || c.url === "/api/slips")).toEqual([]);
  });
});

describe("Floors on Today", () => {
  it("count from the old Pact's Day 1 after an upgrade, so the numbers don't move", async () => {
    server();
    render(<Tracker />);
    expect(await screen.findByText(/^since (21 Sep|Sep 21)$/)).toBeDefined();
    // Sep 21 to 23: 21 has no steps row (no data), 22 short, 23 over.
    const steps = card("Floors").getAllByRole("listitem")[1];
    expect(steps.textContent).toMatch(/1\/2 50%$/);
    expect(await screen.findByText(/8,412 today · as of 12:00\sPM · floor 10,000 · no data for 1 day/)).toBeDefined();
  });

  it("use a count-from date set in Settings", async () => {
    server({ floorsFrom: "2026-09-22" });
    render(<Tracker />);
    expect(await screen.findByText(/^since (22 Sep|Sep 22)$/)).toBeDefined();
    const steps = card("Floors").getAllByRole("listitem")[1];
    expect(steps.textContent).toMatch(/1\/2 50%$/);
  });

  it("without a date, the last 30 days", async () => {
    server({ floorsFrom: null });
    render(<Tracker />);
    expect(await screen.findByText("last 30 days")).toBeDefined();
  });

  it("a fresh install with no steps source shows no Floors card", async () => {
    const { fetch } = server({}, { enabled: false });
    render(<Tracker />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/steps", expect.anything()));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("region", { name: "Floors" })).toBeNull();
  });

  it("with the steps source switched off, the steps line hides", async () => {
    const { fetch } = server(SETTINGS_1X, { enabled: false });
    render(<Tracker />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/steps", expect.anything()));
    await screen.findByRole("region", { name: "Floors" });
    expect(card("Floors").getAllByRole("listitem")).toHaveLength(1);
  });
});

describe("Settings: the Floors card", () => {
  it("shows the count-from date and the steps floor; Save sends them and no 1.x field", async () => {
    const { calls } = server();
    render(<Settings />);
    const from = (await screen.findByLabelText("Floors count from")) as HTMLInputElement;
    await waitFor(() => expect(from.value).toBe("2026-09-21"));
    fireEvent.change(from, { target: { value: "2026-09-01" } });
    fireEvent.change(screen.getByLabelText("Steps floor"), { target: { value: "8000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT")).toBe(true));
    const put = calls.find((c) => c.method === "PUT")!.body as Record<string, unknown>;
    expect(put.floorsFrom).toBe("2026-09-01");
    expect(put.stepsFloor).toBe(8000);
    // The client doesn't send them; the server keeps the stored ones (src/app/api/settings/route.test.ts).
    expect(put).not.toHaveProperty("vices");
    expect(put).not.toHaveProperty("pact");
    expect(put).not.toHaveProperty("flavours");
  });

  it("clearing the date counts the last 30 days; a steps floor under 1 blocks Save", async () => {
    server();
    render(<Settings />);
    const from = (await screen.findByLabelText("Floors count from")) as HTMLInputElement;
    await waitFor(() => expect(from.value).toBe("2026-09-21"));
    fireEvent.change(from, { target: { value: "" } });
    expect(card("Floors").getByText("last 30 days")).toBeDefined();
    fireEvent.change(screen.getByLabelText("Steps floor"), { target: { value: "0" } });
    expect(screen.getByText("Steps floor must be at least 1")).toBeDefined();
    expect(screen.getByRole("button", { name: "Save changes" }).hasAttribute("disabled")).toBe(true);
  });
});
