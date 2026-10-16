import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
import Settings from "@/components/Settings";
import Tracker from "@/components/Tracker";

// A fixed clock: Thu 24 Sep 2026, 2:30 PM local. Only Date is faked; timers stay real.
const NOW = new Date(2026, 8, 24, 14, 30);
const ALCOHOL = { id: "alcohol", name: "Alcohol", chips: ["Beer", "Wine"], cleanSince: "2026-09-01" };
const PACT = { name: "100 days", start: "2026-09-21", days: 100, quits: ["alcohol", "coffee"] };

type SlipRow = { id: string; vice: string; at: string; kind?: string };
type QueuedOp = { kind: string; id?: string; entry?: SlipRow };
const slips = (): SlipRow[] => JSON.parse(window.localStorage.getItem("water.slips.v1") ?? "[]");
const queued = (): QueuedOp[] => JSON.parse(window.localStorage.getItem("water.pending.v1") ?? "[]");
const undoText = () => document.querySelector(".undo-bar")?.textContent;
const useSettings = (s: object) => window.localStorage.setItem("water.settings.v1", JSON.stringify(s));
const card = (name: string) => within(screen.getByRole("region", { name }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Vices on Today", () => {
  it("a fresh install shows no vice cards, no Pact and no Floors", () => {
    render(<Tracker />);
    expect(screen.queryByRole("button", { name: /^Slip/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "Floors" })).toBeNull();
  });

  it("Slip → chip logs it now, with the undo bar; Undo takes it back through the delete path", () => {
    useSettings({ vices: [ALCOHOL] });
    render(<Tracker />);
    expect(card("Alcohol-free").getByText("clean 23 of 23 days")).toBeDefined();
    expect(card("Alcohol-free").getByText("23")).toBeDefined(); // run, Sep 1-23
    fireEvent.click(screen.getByRole("button", { name: "Slip: Alcohol" }));
    fireEvent.click(screen.getByRole("button", { name: "Beer" }));
    expect(slips()).toEqual([expect.objectContaining({ vice: "alcohol", kind: "Beer", at: NOW.toISOString() })]);
    expect(card("Alcohol-free").getByText("1 slip today")).toBeDefined();
    expect(card("Alcohol-free").getByText("0")).toBeDefined(); // a slip today ends the run at once
    expect(card("Alcohol-free").getByText("clean 23 of 23 days")).toBeDefined(); // the hit-rate waits for the day to end
    expect(undoText()).toBe("Logged a slip: BeerUndo");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(slips()).toEqual([]);
    expect(queued().map((op) => op.kind)).toEqual(["upsert-slip", "delete-slip"]);
    expect(card("Alcohol-free").getByText("clean so far")).toBeDefined();
  });

  it("log for yesterday: the slip lands on yesterday at the picked time and breaks the run", () => {
    useSettings({ vices: [ALCOHOL] });
    render(<Tracker />);
    fireEvent.click(screen.getByRole("button", { name: "Slip: Alcohol" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Slip for (Alcohol)" })).getByRole("button", { name: "Yesterday" }));
    fireEvent.change(screen.getByLabelText("Slip time yesterday (Alcohol)"), { target: { value: "22:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Wine" }));
    expect(slips()).toEqual([expect.objectContaining({ kind: "Wine", at: new Date(2026, 8, 23, 22, 30).toISOString() })]);
    expect(undoText()).toBe("Logged a slip: Wine for yesterdayUndo");
    expect(card("Alcohol-free").getByText("clean 22 of 23 days")).toBeDefined();
    expect(card("Alcohol-free").getByText("clean so far")).toBeDefined();
  });

  it("edit a time: tap today's slip time, pick the real one; no future times", () => {
    useSettings({ vices: [ALCOHOL] });
    render(<Tracker />);
    fireEvent.click(screen.getByRole("button", { name: "Slip: Alcohol" }));
    fireEvent.click(screen.getByRole("button", { name: "Beer" }));
    const id = slips()[0].id;
    fireEvent.click(screen.getByRole("button", { name: /^Change slip time/ }));
    fireEvent.change(screen.getByLabelText("Slipped at"), { target: { value: "15:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save time" }));
    expect(screen.getByRole("alert").textContent).toBe("That time hasn't happened yet");
    fireEvent.change(screen.getByLabelText("Slipped at"), { target: { value: "13:05" } });
    fireEvent.click(screen.getByRole("button", { name: "Save time" }));
    expect(slips()).toEqual([expect.objectContaining({ id, at: new Date(2026, 8, 24, 13, 5).toISOString() })]);
    expect(queued().map((op) => op.kind)).toEqual(["upsert-slip", "upsert-slip"]);
  });
});

describe("Pact and Floors", () => {
  it("the Pact's headline is one combined clean day (coffee included), the run beside it, each quit underneath", () => {
    useSettings({ vices: [ALCOHOL], pact: PACT });
    window.localStorage.setItem("water.coffee.v1", JSON.stringify([{ id: "c1", at: new Date(2026, 8, 22, 8).toISOString(), finishedAt: new Date(2026, 8, 22, 9).toISOString() }]));
    render(<Tracker />);
    const pact = card("100 days");
    expect(pact.getByText("day 4 of 100")).toBeDefined();
    expect(pact.getByText("2")).toBeDefined(); // clean Sep 21 and 23; Sep 22 had a coffee
    expect(pact.getByText("of 3 days clean")).toBeDefined();
    expect(pact.getByText("run 1 day")).toBeDefined();
    expect(pact.getByText("so far (of 100) · today pending")).toBeDefined();
    const rows = pact.getAllByRole("listitem").map((li) => li.textContent);
    expect(rows).toEqual(["Alcohol3/3 100%", "Coffee2/3 67%"]);
    // Floors: the water floor over the same days; no steps source, so no steps line.
    const floors = card("Floors");
    expect(floors.getByText("since day 1")).toBeDefined();
    expect(floors.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Water0 oz today0/3 0%"]);
  });

  it("steps show 'as of' the last sync, never live, and score against the steps floor", async () => {
    const days = [
      { day: "2026-09-22", steps: 4000, syncedAt: new Date(2026, 8, 23, 1).toISOString() },
      { day: "2026-09-23", steps: 12000, syncedAt: new Date(2026, 8, 24, 1).toISOString() },
      { day: "2026-09-24", steps: 8412, syncedAt: new Date(2026, 8, 24, 12, 0).toISOString() },
    ];
    const body = (url: string) => (url === "/api/steps" ? { enabled: true, days } : url === "/api/settings" ? { pact: { ...PACT, quits: ["coffee"] } } : url === "/api/health" ? {} : []);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => body(url) })));
    render(<Tracker />);
    expect(await screen.findByText(/8,412 today · as of 12:00\sPM · floor 10,000 · no data for 1 day/)).toBeDefined();
    const steps = card("Floors").getAllByRole("listitem")[1];
    expect(steps.textContent).toMatch(/1\/2 50%$/); // Sep 21 no row (no data), 22 short, 23 over
  });

  it("with the steps source switched off, the steps line hides", async () => {
    const fetch = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => (url === "/api/steps" ? { enabled: false } : url === "/api/settings" ? { pact: PACT } : url === "/api/health" ? {} : []) }));
    vi.stubGlobal("fetch", fetch);
    render(<Tracker />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/steps", expect.anything()));
    await screen.findByRole("region", { name: "Floors" });
    expect(card("Floors").getAllByRole("listitem")).toHaveLength(1);
  });
});

describe("Settings: Vices and Pact", () => {
  it("adds a vice with chips and a clean-since date, sets up a Pact, and Today shows its card", () => {
    render(<Settings />);
    expect(card("Vices").getByText("off")).toBeDefined();
    fireEvent.change(screen.getByLabelText("New vice"), { target: { value: "Alcohol" } });
    fireEvent.click(card("Vices").getByRole("button", { name: "Add" }));
    fireEvent.change(screen.getByLabelText("New chip for Alcohol"), { target: { value: "Beer" } });
    fireEvent.click(screen.getByRole("button", { name: "Add chip" }));
    fireEvent.change(screen.getByLabelText("Clean since (Alcohol)"), { target: { value: "2026-09-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Set up a Pact" }));
    expect(within(screen.getByRole("group", { name: "Pact covers" })).getByRole("button", { name: "Alcohol" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const saved = JSON.parse(window.localStorage.getItem("water.settings.v1")!);
    expect(saved.vices).toEqual([{ id: "alcohol", name: "Alcohol", chips: ["Beer"], cleanSince: "2026-09-01" }]);
    expect(saved.pact).toEqual({ name: "Pact", start: "2026-09-24", days: 100, quits: ["coffee", "alcohol"] });
    cleanup();
    render(<Tracker />);
    expect(screen.getByRole("region", { name: "Alcohol-free" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Pact" })).toBeDefined();
  });

  it("blocks Save on an empty chip, and removing a vice takes it out of the Pact", () => {
    useSettings({ vices: [ALCOHOL], pact: PACT });
    render(<Settings />);
    fireEvent.change(screen.getByLabelText("Chip 1 of Alcohol"), { target: { value: " " } });
    expect(screen.getByText("Every chip needs a name")).toBeDefined();
    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Remove vice Alcohol" }));
    const covers = within(screen.getByRole("group", { name: "Pact covers" })).getAllByRole("button");
    expect(covers.map((b) => b.textContent)).toEqual(["Coffee"]);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(JSON.parse(window.localStorage.getItem("water.settings.v1")!).pact.quits).toEqual(["coffee"]);
  });
});

describe("History", () => {
  it("a section per vice: run and best match Today, slip days on the calendar, by kind, and remove", async () => {
    useSettings({ vices: [ALCOHOL] });
    const at = (d: number, h: number) => new Date(2026, 8, d, h).toISOString();
    window.localStorage.setItem("water.slips.v1", JSON.stringify([
      { id: "s1", vice: "alcohol", at: at(10, 21), kind: "Beer" },
      { id: "s2", vice: "alcohol", at: at(10, 22), kind: "Wine" },
      { id: "s3", vice: "alcohol", at: at(20, 20), kind: "Beer" },
      { id: "x", vice: "sweets", at: at(21, 20) },
    ]));
    const { default: History } = await import("@/components/History");
    render(<History />);
    const section = within(screen.getByRole("region", { name: "Alcohol-free" }));
    expect(section.getByText("clean 21 of 23 days")).toBeDefined(); // the same words as the Today card
    expect(section.getAllByText("ended 2026-09-09")).toHaveLength(1); // best run: Sep 1-9 (ties Sep 11-19; the first one stands)
    expect([...document.querySelectorAll(".cal-cell.slip")].map((c) => c.textContent)).toEqual(["10", "20"]);
    expect(section.getAllByRole("listitem").slice(0, 2).map((li) => li.textContent)).toEqual(["Beer2", "Wine1"]);
    fireEvent.click(section.getByRole("button", { name: "Remove Alcohol slip on 2026-09-20" }));
    expect(slips().map((s) => s.id)).toEqual(["s1", "s2", "x"]);
    expect(queued()).toEqual([{ kind: "delete-slip", id: "s3" }]);
  });
});

describe("offline", () => {
  it("slips logged while the server is down queue, then sync in order when it is back", async () => {
    useSettings({ vices: [ALCOHOL] });
    render(<Tracker />);
    expect(await screen.findByText("Can't reach the server")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Slip: Alcohol" }));
    fireEvent.click(screen.getByRole("button", { name: "Beer" })); // A
    const a = slips()[0];
    vi.setSystemTime(new Date(2026, 8, 24, 14, 45));
    fireEvent.click(screen.getByRole("button", { name: "Slip: Alcohol" }));
    fireEvent.click(screen.getByRole("button", { name: "Wine" })); // B
    const b = slips()[1];
    fireEvent.click(screen.getByRole("button", { name: "Undo" })); // takes back B
    expect(await screen.findByText("2 slips waiting to sync")).toBeDefined();

    // The server comes back: a tiny in-memory server that applies what it is sent.
    const rows = new Map<string, SlipRow>();
    const log: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "POST") {
        const s = JSON.parse(String(init!.body)) as SlipRow;
        rows.set(s.id, s);
        log.push(`POST ${url} ${s.id}`);
      } else if (method === "DELETE") {
        log.push(`DELETE ${url}`);
        rows.delete(decodeURIComponent(url.split("/").pop()!));
      }
      const body = url === "/api/slips" && method === "GET" ? [...rows.values()]
        : url === "/api/settings" ? { vices: [ALCOHOL] } : url === "/api/steps" ? { enabled: false } : url === "/api/health" ? {} : [];
      return { ok: true, status: 200, json: async () => body };
    }));
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(screen.queryByText("2 slips waiting to sync")).toBeNull());
    expect(log).toEqual([`POST /api/slips ${a.id}`, `POST /api/slips ${b.id}`, `DELETE /api/slips/${encodeURIComponent(b.id)}`]);
    expect([...rows.values()]).toEqual([expect.objectContaining({ id: a.id, kind: "Beer", at: NOW.toISOString() })]);
    expect(queued()).toEqual([]);
    expect(slips()).toEqual([expect.objectContaining({ id: a.id })]);
  });
});
