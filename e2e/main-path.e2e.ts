// The main path on an emulated iPhone, against STAGING (demo data): log, undo, refill, change a
// time, log for yesterday, offline and back, the update banner, a Shortcut's request, and no sideways
// scroll at any display size. Every check reads the server afterwards, not just the screen.
//
//   bun run e2e                                         # staging, http://127.0.0.1:4211
//   E2E_BASE_URL=http://127.0.0.1:3000 bun run e2e      # e.g. APP_ENV=staging bun run dev
//
// Refuses any app without the STAGING bar (e2e/support.ts). Removes every drink it logged, even when
// a check fails. Drives this machine's Chrome or Edge (CHROME_PATH to choose).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer, { type Browser, type ElementHandle, type HTTPRequest, type Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BASE, assertStaging, browserPath, hhmm } from "./support";

type Entry = { id: string; at: string; bottleId: string; oz: number };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const entries = async (): Promise<Entry[]> => (await fetch(BASE + "/api/entries", { cache: "no-store" })).json();

let browser: Browser;
let page: Page;
let before = new Set<string>();
const pageErrors: string[] = [];
/** Drinks this run logged: everything on the server that wasn't there at the start. */
const created = async () => (await entries()).filter((e) => !before.has(e.id));

const open = async (path = "/") => {
  await page.goto(BASE + path, { waitUntil: "networkidle0" });
  await wait(1300);
};
const centre = async (el: ElementHandle<Element>) => {
  await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await wait(250);
};
const tap = async (selector: string) => {
  const el = await page.waitForSelector(selector, { timeout: 5000 });
  if (!el) throw new Error(`no ${selector}`);
  await centre(el);
  await el.tap();
};
const tapButton = async (text: RegExp) => {
  const handle = await page.evaluateHandle(
    (src) => [...document.querySelectorAll("button")].find((b) => new RegExp(src).test((b.textContent ?? "").trim())) ?? null,
    text.source,
  );
  const el = handle.asElement() as ElementHandle<Element> | null;
  if (!el) throw new Error(`no button ${text}`);
  await centre(el);
  await el.tap();
};
const setInput = (selector: string, value: string) =>
  page.$eval(
    selector,
    (el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    value,
  );
const textOf = (selector: string) => page.$eval(selector, (e) => (e as HTMLElement).innerText.replace(/\s+/g, " ").trim()).catch(() => null);
const setSize = (percent: number) => page.evaluate((s) => localStorage.setItem("water.display.v1", String(s)), percent);

beforeAll(async () => {
  await assertStaging(BASE);
  before = new Set((await entries()).map((e) => e.id));
  browser = await puppeteer.launch({ executablePath: browserPath(), headless: true, userDataDir: mkdtempSync(join(tmpdir(), "water-e2e-")) });
  page = await browser.newPage();
  page.on("pageerror", (e) => pageErrors.push(e instanceof Error ? e.message : String(e)));
  await page.emulate({
    viewport: { width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  await open();
  await setSize(90);
  await open();
});

afterAll(async () => {
  await page?.setOfflineMode(false).catch(() => {});
  await browser?.close();
  for (const e of await created()) await fetch(BASE + "/api/entries/" + encodeURIComponent(e.id), { method: "DELETE" });
  expect((await created()).length, "every drink this run logged is removed again").toBe(0);
});

describe(`main path on ${BASE}`, () => {
  it("logs a drink, offers Undo, and Undo removes it from the server", async () => {
    await tapButton(/^Log \d/);
    await wait(1500);
    expect(await created(), "Log saves a drink").toHaveLength(1);
    expect(await textOf(".undo-bar"), "the undo bar appears").toMatch(/Logged .*Undo/);
    await tap(".undo-bar__btn");
    await wait(1800);
    expect(await created(), "Undo removes it from the server").toHaveLength(0);
    await wait(6500);
    expect(await page.$(".undo-bar"), "the undo bar goes away after about 6 s").toBeNull();
  });

  it("Refill logs the same bottle and amount again", async () => {
    await tapButton(/^Log \d/);
    await wait(1500);
    await tap('button[aria-label^="Refill"]');
    await wait(1800);
    const rows = await created();
    expect(rows).toHaveLength(2);
    expect(rows[1].bottleId).toBe(rows[0].bottleId);
    expect(rows[1].oz).toBe(rows[0].oz);
  });

  it("changes a drink's time on the server, and refuses a time that hasn't happened", async () => {
    const now = new Date();
    const sinceMidnight = now.getHours() * 60 + now.getMinutes();
    const latest = (await created()).sort((a, b) => b.at.localeCompare(a.at))[0];
    // Stay on today's date whenever the test runs: up to 45 minutes earlier, never before 00:00.
    const earlier = hhmm(new Date(now.getTime() - Math.min(45, sinceMidnight - 1) * 60_000));
    await tap('button[aria-label^="Change time"]');
    await setInput('input[aria-label="Finished at"]', earlier);
    await tapButton(/^Save time$/);
    await wait(1800);
    const moved = (await created()).find((e) => e.id === latest.id);
    expect(moved, "the same drink, not a new one").toBeDefined();
    expect(hhmm(new Date(moved!.at)), "its new time is on the server").toBe(earlier);

    const untilMidnight = 24 * 60 - sinceMidnight;
    if (untilMidnight < 3) return; // no later minute left today to try
    const future = hhmm(new Date(now.getTime() + Math.min(90, untilMidnight - 1) * 60_000));
    await tap('button[aria-label^="Change time"]');
    await setInput('input[aria-label="Finished at"]', future);
    await tapButton(/^Save time$/);
    await wait(1200);
    expect(await page.evaluate(() => document.body.innerText), "a future time is refused on screen").toMatch(/hasn't happened yet/);
    const still = (await created()).find((e) => e.id === latest.id);
    expect(hhmm(new Date(still!.at)), "and the server keeps the earlier time").toBe(earlier);
    await page.keyboard.press("Escape").catch(() => {});
    await open();
  });

  it("logs a drink for yesterday at the chosen time, then switches back to Today", async () => {
    await open();
    const n = (await created()).length;
    await tapButton(/^Yesterday$/);
    await wait(400);
    expect(await page.$eval('input[aria-label="Time yesterday"]', (e) => (e as HTMLInputElement).value), "starts at 9:00 PM").toBe("21:00");
    await setInput('input[aria-label="Time yesterday"]', "20:30");
    await tapButton(/^Log \d/);
    await wait(1800);
    const rows = await created();
    expect(rows).toHaveLength(n + 1);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const row = rows.find((e) => hhmm(new Date(e.at)) === "20:30");
    expect(row && new Date(row.at).toDateString(), "lands on yesterday at 20:30").toBe(yesterday.toDateString());
    expect(await page.$eval('[aria-label="Log for"] button[aria-pressed="true"]', (e) => e.textContent?.trim()), "switch returns to Today").toBe("Today");
    expect(await textOf(".undo-bar"), "the undo bar says so").toMatch(/for yesterday/);
  });

  it("offline: queues two drinks, says so, and sends both in order when back online", async () => {
    await open();
    const n = (await created()).length;
    await page.setOfflineMode(true);
    try {
      await tapButton(/^Log \d/);
      await wait(700);
      await tapButton(/^Log \d/);
      await wait(2500); // banners wait 1.2 s after the last touch
      expect(await textOf(".app-banner"), "the banner counts what's waiting").toBe("2 drinks waiting to sync");
      expect(await created(), "nothing reached the server while offline").toHaveLength(n);
    } finally {
      await page.setOfflineMode(false);
    }
    let synced = false;
    for (let i = 0; i < 25 && !synced; i++) {
      await wait(1000);
      synced = (await created()).length === n + 2;
    }
    expect(synced, "both drinks reach the server once online").toBe(true);
    await wait(2500);
    expect(await page.$(".app-banner"), "the banner clears").toBeNull();
  });

  it("offers 'New version — tap to reload' when the server runs another release, and only reloads on a tap", async () => {
    const fakeNewRelease = (r: HTTPRequest) =>
      new URL(r.url()).pathname === "/api/health"
        ? r.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, version: "9.9.9+e2e", db: true }) })
        : r.continue();
    await page.setRequestInterception(true);
    page.on("request", fakeNewRelease);
    try {
      await open();
      await wait(2000);
      expect(await textOf(".app-banner--update")).toBe("New version — tap to reload");
      expect(await page.evaluate(() => (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming)?.type), "never reloads by itself").not.toBe("reload");
      const reloaded = page.waitForNavigation({ timeout: 8000 }).then(() => true, () => false);
      await tap(".app-banner--update");
      expect(await reloaded, "tapping it reloads").toBe(true);
    } finally {
      page.off("request", fakeNewRelease);
      await page.setRequestInterception(false);
    }
    await open();
    await wait(2000);
    expect(await page.$(".app-banner--update"), "no banner when the versions match").toBeNull();
  });

  it("a Shortcut logs a bottle by name, once per request id, refuses an unknown bottle, and the open app shows it", async () => {
    await open();
    const { bottles } = (await (await fetch(BASE + "/api/settings", { cache: "no-store" })).json()) as { bottles: { id: string; name: string; oz: number }[] };
    const bottle = bottles[0];
    const n = (await created()).length;
    const loggedToday = () => page.evaluate(() => {
      const head = [...document.querySelectorAll(".ink-card__head")].find((h) => h.textContent?.startsWith("Logged today"));
      return Number(head?.textContent?.match(/(\d+) drinks?$/)?.[1] ?? 0);
    });
    const shownBefore = await loggedToday();
    // What the Shortcut sends: a name, no id, no time, no ounces.
    const send = (body: object) => fetch(BASE + "/api/log", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const requestId = `e2e-${Date.now()}`;

    const first = await send({ bottle: bottle.name.toUpperCase(), fraction: 0.5, requestId });
    expect(first.status, "logged").toBe(201);
    expect((await first.json()).message).toMatch(/^Logged .* · ½ /);
    const again = await send({ bottle: bottle.name, fraction: 0.5, requestId });
    expect(again.status, "the same request again").toBe(200);
    expect((await again.json()).message).toMatch(/^Already logged/);
    const rows = await created();
    expect(rows, "one drink, not two").toHaveLength(n + 1);
    expect(rows.find((e) => e.id === `log-${requestId}`), "its size comes from Settings").toMatchObject({ bottleId: bottle.id, oz: Math.round(bottle.oz * 5) / 10 });

    const unknown = await send({ bottle: "No such bottle e2e" });
    expect(unknown.status, "an unknown bottle is refused").toBe(400);
    expect((await unknown.json()).message).toMatch(/^No bottle called "No such bottle e2e"/);
    expect(await created(), "and nothing is written").toHaveLength(n + 1);

    // Back to the open app: it pulls, and the drink is an ordinary row with an ✕.
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await wait(2000);
    expect(await loggedToday(), "the open app shows it").toBe(shownBefore + 1);
    await tap('button[aria-label^="Remove "][aria-label$=" oz entry"]'); // the newest drink is at the top
    await wait(1800);
    expect((await created()).some((e) => e.id === `log-${requestId}`), "✕ removes it from the server").toBe(false);
  });

  it("never scrolls sideways on Today, History or Settings at 80, 90 or 125 %", async () => {
    const over: string[] = [];
    for (const size of [80, 90, 125]) {
      await setSize(size);
      for (const path of ["/", "/history", "/settings"]) {
        await open(path);
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) over.push(`${size}% ${path}`);
      }
    }
    await setSize(90);
    expect(over).toEqual([]);
  });

  it("threw no JavaScript errors on any page", () => {
    expect(pageErrors).toEqual([]);
  });
});
