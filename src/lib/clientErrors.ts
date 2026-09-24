// Browser errors reported to the server log. Pure: the payload builder runs in the browser
// (src/instrumentation-client.ts), the parser and limiter in /api/client-errors.
// Only what a stack trace needs: message, stack, path (no query string) and user agent.

export const MAX_BODY_BYTES = 8 * 1024;
export const MAX_STACK = 2 * 1024;
export const MAX_MESSAGE = 500;
const MAX_PATH = 200;
const MAX_UA = 300;

export interface ClientError {
  message: string;
  stack: string;
  path: string;
  ua: string;
}

function clip(s: unknown, max: number): string {
  return typeof s === "string" ? s.slice(0, max) : "";
}

/** A path only: any query string or fragment is dropped, since those could carry data. */
function cleanPath(p: unknown): string {
  return clip(typeof p === "string" ? p.split(/[?#]/)[0] : "", MAX_PATH);
}

/** Browser side: from an ErrorEvent's error or a rejection reason. */
export function buildPayload(reason: unknown, fallbackMessage: string, path: string): Omit<ClientError, "ua"> {
  const err = reason instanceof Error ? reason : null;
  const message = err ? `${err.name}: ${err.message}` : typeof reason === "string" ? reason : fallbackMessage;
  return { message: clip(message || "Unknown error", MAX_MESSAGE), stack: clip(err?.stack, MAX_STACK), path: cleanPath(path) };
}

/** Server side: whatever arrived, trimmed to the known fields. Null if it is not a report. */
export function parseReport(body: string, userAgent: string | null): ClientError | null {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const message = clip(r.message, MAX_MESSAGE);
  if (!message) return null;
  return { message, stack: clip(r.stack, MAX_STACK), path: cleanPath(r.path), ua: clip(userAgent ?? "", MAX_UA) };
}

/** Fixed-window counter: at most `max` accepted per `windowMs`. One per server process. */
export function createRateLimiter(max: number, windowMs: number) {
  let windowStart = -Infinity;
  let count = 0;
  return (nowMs: number): boolean => {
    if (nowMs - windowStart >= windowMs) {
      windowStart = nowMs;
      count = 0;
    }
    if (count >= max) return false;
    count++;
    return true;
  };
}
