// Server sync with an offline-first local cache.
//
// Reads: the cache renders instantly; a fetch refreshes it. Writes: applied locally first,
// then sent; a failed send is queued in localStorage and retried on the next load, so a tap
// never fails and never duplicates (POST is an upsert on the entry id).
import type { CoffeeEntry } from "./coffee";
import type { Entry } from "./log";
import { normalizeSettings, type Settings } from "./settings";

const PENDING_KEY = "water.pending.v1";

export type Op =
  | { kind: "upsert-entry"; entry: Entry }
  | { kind: "delete-entry"; id: string }
  | { kind: "upsert-coffee"; entry: CoffeeEntry }
  | { kind: "delete-coffee"; id: string };

function canStore(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadPending(): Op[] {
  if (!canStore()) return [];
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Op[]) : [];
  } catch {
    return [];
  }
}

function savePending(ops: Op[]): void {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(ops));
  } catch {
    // ignore
  }
}

async function send(op: Op): Promise<void> {
  const [url, init]: [string, RequestInit] =
    op.kind === "upsert-entry"
      ? ["/api/entries", { method: "POST", body: JSON.stringify(op.entry), headers: { "content-type": "application/json" } }]
      : op.kind === "delete-entry"
        ? [`/api/entries/${encodeURIComponent(op.id)}`, { method: "DELETE" }]
        : op.kind === "upsert-coffee"
          ? ["/api/coffee", { method: "POST", body: JSON.stringify(op.entry), headers: { "content-type": "application/json" } }]
          : [`/api/coffee/${encodeURIComponent(op.id)}`, { method: "DELETE" }];
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${op.kind} failed: ${res.status}`);
}

/** Send one op now; on failure, queue it. Returns true if it reached the server. */
export async function sendOrQueue(op: Op): Promise<boolean> {
  try {
    await send(op);
    return true;
  } catch {
    savePending([...loadPending(), op]);
    return false;
  }
}

/** Retry everything queued, in order. Stops at the first failure so order is preserved. */
export async function flushPending(): Promise<number> {
  const ops = loadPending();
  let sent = 0;
  for (const op of ops) {
    try {
      await send(op);
      sent++;
    } catch {
      break;
    }
  }
  savePending(ops.slice(sent));
  return ops.length - sent;
}

export async function fetchEntries(): Promise<Entry[]> {
  const res = await fetch("/api/entries", { cache: "no-store" });
  if (!res.ok) throw new Error(`entries ${res.status}`);
  return (await res.json()) as Entry[];
}

export async function fetchCoffee(): Promise<CoffeeEntry[]> {
  const res = await fetch("/api/coffee", { cache: "no-store" });
  if (!res.ok) throw new Error(`coffee ${res.status}`);
  return (await res.json()) as CoffeeEntry[];
}

export async function fetchSettings(): Promise<Settings> {
  const res = await fetch("/api/settings", { cache: "no-store" });
  if (!res.ok) throw new Error(`settings ${res.status}`);
  return normalizeSettings(await res.json());
}

export async function putSettings(s: Settings): Promise<boolean> {
  try {
    const res = await fetch("/api/settings", { method: "PUT", body: JSON.stringify(s), headers: { "content-type": "application/json" } });
    return res.ok;
  } catch {
    return false;
  }
}
