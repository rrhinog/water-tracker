import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
import Settings from "@/components/Settings";
import Tracker from "@/components/Tracker";

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
    expect(within(group).getByRole("button", { name: "100%" }).getAttribute("aria-pressed")).toBe("true");
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
