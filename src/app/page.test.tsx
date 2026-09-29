import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
import Settings from "@/components/Settings";
import Tracker from "@/components/Tracker";
import { DEFAULT_DISPLAY } from "@/lib/display";

describe("Tracker", () => {
  // No server in unit tests: every fetch rejects, so the hook stays on the local cache.
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
  });
  // Each test gets a fresh DOM and a fresh localStorage.
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("defaults to the first container, full, so the common case is one tap", () => {
    render(<Tracker />);
    expect(screen.getByRole("button", { name: /^Yeti/ })).toBeDefined();
    expect(screen.getByRole("slider")).toBeDefined();
    expect(screen.getByRole("button", { name: /Log 40 oz/ })).toBeDefined();
  });

  it("remembers the picked bottle; slider picks a fraction and resets to full after logging", () => {
    render(<Tracker />);
    fireEvent.click(screen.getByRole("button", { name: /^Yeti/ }));
    expect(window.localStorage.getItem("water.bottle.v1")).toBe("yeti");
    fireEvent.change(screen.getByRole("slider"), { target: { value: "1" } }); // half
    fireEvent.click(screen.getByRole("button", { name: /Log 18 oz/ }));
    expect(screen.getByText("18")).toBeDefined();
    expect(screen.getByRole("button", { name: /Log 36 oz/ })).toBeDefined();
  });

  it("adds an entry on tap and removes it with the row's remove button", () => {
    render(<Tracker />);
    fireEvent.click(screen.getByRole("button", { name: /Log 40 oz/ }));
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
    fireEvent.click(screen.getByRole("button", { name: /Remove 40 oz entry/ }));
    expect(screen.getByText("0")).toBeDefined();
    expect(screen.getByText("Nothing yet.")).toBeDefined();
  });

  it("logs a one-off amount, remembers it as a chip, and returns to the usual bottle", () => {
    render(<Tracker />);
    fireEvent.click(screen.getByRole("button", { name: /^Other/ }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Amount in oz" }), { target: { value: "16.9" } });
    fireEvent.click(screen.getByRole("button", { name: /Log 16.9 oz/ }));
    expect(screen.getByText("16.9")).toBeDefined();
    // back on the bottle slider
    expect(screen.getByRole("button", { name: /Log 40 oz/ })).toBeDefined();
    // the amount is now a one-tap chip under Other
    fireEvent.click(screen.getByRole("button", { name: /^Other/ }));
    fireEvent.click(screen.getByRole("button", { name: "16.9 oz" }));
    expect(screen.getByText("33.8")).toBeDefined();
  });

  it("shows the pace section with a mode toggle that persists", () => {
    render(<Tracker />);
    expect(screen.getByText("Pace")).toBeDefined();
    const even = screen.getByRole("button", { name: "Even" });
    fireEvent.click(even);
    expect(even.getAttribute("aria-pressed")).toBe("true");
    expect(window.localStorage.getItem("water.pace.v1")).toBe("even");
  });

  it("logs a coffee without touching the water total, and removes it", () => {
    render(<Tracker />);
    fireEvent.click(screen.getByRole("button", { name: /Log 40 oz/ }));
    fireEvent.click(screen.getByRole("button", { name: "+ Coffee" }));
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
    expect(screen.getAllByText(/1 today/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove coffee" })[0]);
    expect(screen.getAllByText(/clean so far/).length).toBeGreaterThan(0);
  });

  it("shows mL everywhere when the unit setting is mL", () => {
    window.localStorage.setItem("water.settings.v1", JSON.stringify({ unit: "ml" }));
    render(<Tracker />);
    expect(screen.getByRole("button", { name: /Log 1183 mL/ })).toBeDefined(); // 40 oz
    expect(screen.getByText(/2957 mL to the floor/)).toBeDefined(); // 100 oz
  });

  it("settings page keeps edits as a draft until Save, and Discard reverts them", () => {
    render(<Settings />);
    const save = screen.getByRole("button", { name: "Save changes" });
    expect(save.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "mL" }));
    expect(screen.getByText("Unsaved changes")).toBeDefined();
    expect(window.localStorage.getItem("water.settings.v1")).toBeNull(); // not applied yet
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByRole("button", { name: "oz" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "mL" }));
    fireEvent.click(save);
    expect(JSON.parse(window.localStorage.getItem("water.settings.v1")!).unit).toBe("ml");
    expect(save.hasAttribute("disabled")).toBe(true);
  });

  it("display size applies on tap, stays on this device, and never touches the Save bar", () => {
    render(<Settings />);
    const group = screen.getByRole("group", { name: "Display size" });
    expect(within(group).getByRole("button", { name: `${DEFAULT_DISPLAY}%` }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(group).getByRole("button", { name: "80%" }));
    expect(within(group).getByRole("button", { name: "80%" }).getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.style.getPropertyValue("--display-scale")).toBe("0.8");
    expect(window.localStorage.getItem("water.display.v1")).toBe("80");
    expect(window.localStorage.getItem("water.settings.v1")).toBeNull(); // not a synced setting
    expect(screen.getByText("All changes saved")).toBeDefined();
    expect(screen.getByRole("button", { name: "Save changes" }).hasAttribute("disabled")).toBe(true);
    document.documentElement.removeAttribute("style");
  });

  it("settings page blocks Save on an invalid draft", () => {
    render(<Settings />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name of Yeti" }), { target: { value: "" } });
    expect(screen.getByText("Every container needs a name")).toBeDefined();
    expect(screen.getByRole("button", { name: "Save changes" }).hasAttribute("disabled")).toBe(true);
  });

  it("settings refuses an accent that fails contrast and accepts a swatch", () => {
    render(<Settings />);
    const save = screen.getByRole("button", { name: "Save changes" });
    fireEvent.change(screen.getByLabelText("Custom accent"), { target: { value: "#7dd3fc" } });
    expect(screen.getAllByText(/too light for white text/).length).toBeGreaterThan(0);
    expect(save.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Deep teal" }));
    expect(save.hasAttribute("disabled")).toBe(false);
    fireEvent.click(save);
    expect(JSON.parse(window.localStorage.getItem("water.settings.v1")!).accent).toBe("#0f6e8c");
  });

  it("a logged coffee is open with a Finished button; finishing records the window", () => {
    render(<Tracker />);
    fireEvent.click(screen.getByRole("button", { name: "+ Coffee" }));
    expect(screen.getAllByText(/open \d/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Finished" })[0]);
    expect(screen.getAllByText(/finished 0m/).length).toBeGreaterThan(0);
    const stored = JSON.parse(window.localStorage.getItem("water.coffee.v1")!);
    expect(stored[0].finishedAt).toBeDefined();
  });

  it("logs with the first flavour by default and lets the open coffee change it", () => {
    render(<Tracker />);
    fireEvent.click(screen.getByRole("button", { name: "+ Coffee" }));
    expect(screen.getAllByText(/BRCC Spirit of '76/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Starbucks Vanilla" })[0]);
    const stored = JSON.parse(window.localStorage.getItem("water.coffee.v1")!);
    expect(stored[0].flavour).toBe("Starbucks Vanilla");
  });
});

describe("Log faster (v1.8)", () => {
  // A fixed clock. Only Date is faked; timers stay real so React and the retry loop run normally.
  const NOW = new Date(2026, 8, 24, 14, 30);
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
  type Row = { id: string; at: string; bottleId: string; fraction: number; oz: number };
  type QueuedOp = { kind: string; id?: string; entry?: Row };
  const stored = (): Row[] => JSON.parse(window.localStorage.getItem("water.entries.v1") ?? "[]");
  const queued = (): QueuedOp[] => JSON.parse(window.localStorage.getItem("water.pending.v1") ?? "[]");
  const undoText = () => document.querySelector(".undo-bar")?.textContent;

  it("undo: a drink shows 'Logged 40 oz · Undo', and Undo removes it through the delete path", () => {
    render(<Tracker />);
    fireEvent.click(screen.getByRole("button", { name: /Log 40 oz/ }));
    expect(undoText()).toBe("Logged 40 ozUndo");
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText("Nothing yet.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(stored()).toEqual([]);
    expect(queued().map((op) => op.kind)).toEqual(["upsert-entry", "delete-entry"]);
  });

  it("undo: a coffee shows 'Logged a coffee · Undo' and Undo takes it back", () => {
    render(<Tracker />);
    fireEvent.click(screen.getByRole("button", { name: "+ Coffee" }));
    expect(screen.getAllByText("Logged a coffee").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Undo" })[0]);
    expect(screen.getAllByText(/clean so far/).length).toBeGreaterThan(0);
    expect(JSON.parse(window.localStorage.getItem("water.coffee.v1")!)).toEqual([]);
  });

  it("undo: the bar goes by itself after about six seconds, and the drink stays", async () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    render(<Tracker />);
    fireEvent.click(screen.getByRole("button", { name: /Log 40 oz/ }));
    await act(() => vi.advanceTimersByTimeAsync(5900));
    expect(screen.getByRole("button", { name: "Undo" })).toBeDefined();
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(stored()).toHaveLength(1);
  });

  it("refill: one tap logs the last drink again, same bottle and amount, now", () => {
    render(<Tracker />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "1" } }); // half of the first bottle
    fireEvent.click(screen.getByRole("button", { name: /Log 20 oz/ }));
    vi.setSystemTime(new Date(2026, 8, 24, 15, 45));
    fireEvent.click(screen.getByRole("button", { name: "Refill 20 oz" }));
    const [first, again] = stored();
    expect(again.id).not.toBe(first.id);
    expect({ bottleId: again.bottleId, fraction: again.fraction, oz: again.oz }).toEqual({ bottleId: first.bottleId, fraction: 0.5, oz: 20 });
    expect(again.at).toBe(new Date(2026, 8, 24, 15, 45).toISOString());
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
    expect(undoText()).toContain("Logged 20 oz");
    // Only the latest drink carries the button.
    expect(screen.getAllByRole("button", { name: /^Refill/ })).toHaveLength(1);
  });

  it("refill works for a one-off Other amount", () => {
    render(<Tracker />);
    fireEvent.click(screen.getByRole("button", { name: /^Other/ }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Amount in oz" }), { target: { value: "16.9" } });
    fireEvent.click(screen.getByRole("button", { name: /Log 16.9 oz/ }));
    fireEvent.click(screen.getByRole("button", { name: "Refill 16.9 oz" }));
    expect(screen.getByText("33.8")).toBeDefined();
    expect(stored().map((e) => e.bottleId)).toEqual(["other", "other"]);
  });

  it("edit a time: tap the time, pick the real one; same id, sent as an upsert; no future times", () => {
    render(<Tracker />);
    fireEvent.click(screen.getByRole("button", { name: /Log 40 oz/ }));
    const id = stored()[0].id;
    fireEvent.click(screen.getByRole("button", { name: /^Change time/ }));
    const picker = screen.getByLabelText("Finished at") as HTMLInputElement;
    expect(picker.value).toBe("14:30");
    fireEvent.change(picker, { target: { value: "15:10" } });
    fireEvent.click(screen.getByRole("button", { name: "Save time" }));
    expect(screen.getByRole("alert").textContent).toBe("That time hasn't happened yet");
    expect(stored()[0].at).toBe(NOW.toISOString()); // unchanged
    fireEvent.change(screen.getByLabelText("Finished at"), { target: { value: "14:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save time" }));
    expect(screen.queryByLabelText("Finished at")).toBeNull();
    const at = new Date(2026, 8, 24, 14, 0).toISOString();
    expect(stored()).toEqual([expect.objectContaining({ id, at })]);
    expect(queued().at(-1)).toEqual({ kind: "upsert-entry", entry: expect.objectContaining({ id, at }) });
    expect(screen.getByRole("button", { name: /^Change time/ }).textContent).toMatch(/2:00/);
  });

  it("edit a time: Cancel leaves the drink alone", () => {
    render(<Tracker />);
    fireEvent.click(screen.getByRole("button", { name: /Log 40 oz/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Change time/ }));
    fireEvent.change(screen.getByLabelText("Finished at"), { target: { value: "09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(stored()[0].at).toBe(NOW.toISOString());
  });

  it("log for yesterday: 9:00 PM by default, lands on yesterday, and the log goes back to Today", () => {
    render(<Tracker />);
    const day = screen.getByRole("group", { name: "Log for" });
    expect(within(day).getByRole("button", { name: "Today" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(day).getByRole("button", { name: "Yesterday" }));
    expect(screen.getByText("Log for yesterday")).toBeDefined();
    const time = screen.getByLabelText("Time yesterday") as HTMLInputElement;
    expect(time.value).toBe("21:00");
    fireEvent.change(time, { target: { value: "20:15" } });
    fireEvent.click(screen.getByRole("button", { name: /Log 40 oz/ }));
    const yesterday = new Date(2026, 8, 23, 20, 15).toISOString();
    expect(stored()[0].at).toBe(yesterday);
    expect(undoText()).toContain("Logged 40 oz for yesterday");
    // Not in today's total or list; the switch is back on Today and the picker is gone.
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
    expect(screen.getByText("Nothing yet.")).toBeDefined();
    expect(within(day).getByRole("button", { name: "Today" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByLabelText("Time yesterday")).toBeNull();
    // The next log is today again.
    fireEvent.click(screen.getByRole("button", { name: /Log 40 oz/ }));
    expect(stored().map((e) => e.at)).toEqual([yesterday, NOW.toISOString()]);
  });

  it("a drink logged for yesterday is on yesterday in History", async () => {
    window.localStorage.setItem("water.entries.v1", JSON.stringify([{ id: "y1", at: new Date(2026, 8, 23, 21, 0).toISOString(), bottleId: "yeti", fraction: 1, oz: 36 }]));
    const { default: History } = await import("@/components/History");
    render(<History />);
    const bars = [...document.querySelectorAll(".bar")].map((b) => b.getAttribute("title"));
    expect(bars.at(-2)).toMatch(/: 36 oz/); // yesterday's bar
    expect(bars.at(-1)).toMatch(/: 0 oz/); // today's
  });

  it("offline: log, refill, edit and undo work locally and queue; they sync in order when the server is back", async () => {
    render(<Tracker />);
    expect(await screen.findByText("Can't reach the server")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Log 40 oz/ })); // A
    const a = stored()[0].id;
    vi.setSystemTime(new Date(2026, 8, 24, 14, 45));
    fireEvent.click(screen.getByRole("button", { name: "Refill 40 oz" })); // B
    const b = stored()[1].id;
    fireEvent.click(screen.getAllByRole("button", { name: /^Change time/ })[1]); // A is the older row
    fireEvent.change(screen.getByLabelText("Finished at"), { target: { value: "13:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save time" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" })); // takes back B, the refill
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("40");
    expect(await screen.findByText("2 drinks waiting to sync")).toBeDefined();
    expect(queued().map((op) => `${op.kind} ${op.id ?? op.entry!.id}`)).toEqual([`upsert-entry ${a}`, `upsert-entry ${b}`, `upsert-entry ${a}`, `delete-entry ${b}`]);

    // The server comes back: a tiny in-memory server that applies what it is sent.
    const rows = new Map<string, Row>();
    const log: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "POST") {
        const e = JSON.parse(String(init!.body)) as Row;
        rows.set(e.id, e);
        log.push(`POST ${e.id} ${e.at}`);
      } else if (method === "DELETE") {
        const id = decodeURIComponent(url.split("/").pop()!);
        rows.delete(id);
        log.push(`DELETE ${id}`);
      }
      const body = url === "/api/entries" && method === "GET" ? [...rows.values()] : url === "/api/coffee" ? [] : {};
      return { ok: true, status: 200, json: async () => body };
    }));
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(screen.queryByText("2 drinks waiting to sync")).toBeNull());
    expect(log).toEqual([
      `POST ${a} ${NOW.toISOString()}`,
      `POST ${b} ${new Date(2026, 8, 24, 14, 45).toISOString()}`,
      `POST ${a} ${new Date(2026, 8, 24, 13, 0).toISOString()}`,
      `DELETE ${b}`,
    ]);
    expect([...rows.values()]).toEqual([expect.objectContaining({ id: a, at: new Date(2026, 8, 24, 13, 0).toISOString() })]);
    expect(queued()).toEqual([]);
    expect(screen.queryByText("Can't reach the server")).toBeNull();
    expect(stored()).toEqual([expect.objectContaining({ id: a })]);
  });

  it("update banner: shown when /api/health reports another release; it never reloads by itself", async () => {
    document.documentElement.dataset.version = "1.7.1+eebbbcf";
    const body = (url: string) => (url === "/api/health" ? { ok: true, version: "1.8.0+abc1234" } : url === "/api/settings" ? {} : []);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => body(url) })));
    render(<Tracker />);
    expect(await screen.findByRole("button", { name: "New version — tap to reload" })).toBeDefined();
    delete document.documentElement.dataset.version;
  });

  it("update banner: nothing when the release is the same", async () => {
    document.documentElement.dataset.version = "1.8.0+abc1234";
    const body = (url: string) => (url === "/api/health" ? { ok: true, version: "1.8.0+abc1234" } : url === "/api/settings" ? {} : []);
    const fetch = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => body(url) }));
    vi.stubGlobal("fetch", fetch);
    render(<Tracker />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/health", expect.anything()));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("button", { name: /New version/ })).toBeNull();
    delete document.documentElement.dataset.version;
  });
});
