// Where the main-path test runs, which browser it drives, and the guard that keeps it off live data.
import { existsSync } from "node:fs";

/** Staging by default. Any other app works only if it shows the STAGING bar (assertStaging). */
export const BASE = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:4211").replace(/\/$/, "");

/** Chrome or Edge on this machine; CHROME_PATH picks one. */
export function browserPath(): string {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((p): p is string => !!p);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("no Chrome or Edge found: set CHROME_PATH");
  return found;
}

/**
 * The test logs and deletes drinks, so it runs only where the page shows the STAGING bar
 * (APP_ENV=staging, which only the staging container sets). Live never shows it.
 */
export async function assertStaging(base: string): Promise<void> {
  let html: string;
  try {
    html = await (await fetch(base + "/", { cache: "no-store" })).text();
  } catch {
    throw new Error(`nothing answers at ${base}: deploy staging first (.\\scripts\\deploy.ps1 staging)`);
  }
  if (!html.includes('class="staging-banner"')) {
    throw new Error(`refusing to run against ${base}: the page has no STAGING bar, so it may hold real data`);
  }
}

/** HH:MM in this machine's time zone, as a <input type="time"> takes it. */
export function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
