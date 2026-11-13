// Server sync with an offline-first local cache.
//
// Reads: the cache renders instantly; a fetch refreshes it. Writes: applied locally first, then
// appended to a queue in localStorage and sent in order; what fails stays queued and is retried
// (useSynced: on load, when the browser comes back online or to the foreground, and every few
// seconds while offline). A tap never fails and never duplicates (POST is an upsert on the id).
//
// Every write goes through the queue, even when it is empty: sending a new change ahead of older
// queued ones would let an Undo reach the server before the drink it removes, and the drink would
// come back when the queue caught up.
import type { Entry } from "./log";
import type { RetiredCoffee, RetiredSlip } from "./retired";
import { normalizeSettings, type Settings } from "./settings";

const PENDING_KEY = "water.pending.v1";
const SEND_TIMEOUT_MS = 10_000;

function timeout(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(ms) : undefined;
}

// The coffee and slip kinds are no longer created (2.0 doesn't log either), but a phone may still hold
// some, queued under 1.x while offline. They are sent to their old routes, which still accept them,
// until 2.1 (src/lib/retired.ts, docs/specs/split.md).
export type Op =
  | { kind: "upsert-entry"; entry: Entry }
  | { kind: "delete-entry"; id: string }
  | { kind: "upsert-coffee"; entry: RetiredCoffee }
  | { kind: "delete-coffee"; id: string }
  | { kind: "upsert-slip"; entry: RetiredSlip }
  | { kind: "delete-slip"; id: string };

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

const JSON_HEADERS = { "content-type": "application/json" };

/**
 * Where a queued change goes. Every kind is named here, the old coffee and slip kinds included: a kind
 * missing from this list would fall through to the last branch and be sent as a slip delete.
 */
export function routeFor(op: Op): [string, RequestInit] {
  switch (op.kind) {
    case "upsert-entry":
      return ["/api/entries", { method: "POST", body: JSON.stringify(op.entry), headers: JSON_HEADERS }];
    case "delete-entry":
      return [`/api/entries/${encodeURIComponent(op.id)}`, { method: "DELETE" }];
    case "upsert-coffee":
      return ["/api/coffee", { method: "POST", body: JSON.stringify(op.entry), headers: JSON_HEADERS }];
    case "delete-coffee":
      return [`/api/coffee/${encodeURIComponent(op.id)}`, { method: "DELETE" }];
    case "upsert-slip":
      return ["/api/slips", { method: "POST", body: JSON.stringify(op.entry), headers: JSON_HEADERS }];
    default:
      // "delete-slip", and (as in 1.x) anything unrecognised.
      return [`/api/slips/${encodeURIComponent((op as { id: string }).id)}`, { method: "DELETE" }];
  }
}

async function send(op: Op): Promise<void> {
  const [url, init] = routeFor(op);
  // A server that can't be reached can hang rather than refuse; give up so the queue can retry.
  const res = await fetch(url, { ...init, signal: timeout(SEND_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${op.kind} failed: ${res.status}`);
}

/** Queue one op and flush the queue in order. Returns true if the queue is empty afterwards. */
export async function sendOrQueue(op: Op): Promise<boolean> {
  savePending([...loadPending(), op]);
  return (await flushPending()) === 0;
}

// One flush at a time: two overlapping flushes could each send the same queue and interleave
// (upsert, delete, upsert), bringing a deleted row back.
let flushing: Promise<number> = Promise.resolve(0);

/** Retry everything queued, in order. Stops at the first failure so order is preserved. Returns what is left. */
export function flushPending(): Promise<number> {
  flushing = flushing.then(flushOnce, flushOnce);
  return flushing;
}

async function flushOnce(): Promise<number> {
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
  // Re-read: a tap during the flush appended to the end, and must not be lost.
  const left = loadPending().slice(sent);
  savePending(left);
  return left.length;
}

export async function fetchEntries(): Promise<Entry[]> {
  const res = await fetch("/api/entries", { cache: "no-store" });
  if (!res.ok) throw new Error(`entries ${res.status}`);
  return (await res.json()) as Entry[];
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
