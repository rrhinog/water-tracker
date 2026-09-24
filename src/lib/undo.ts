// The undo bar after a log: "Logged 36 oz · Undo" for a few seconds. Pure, no browser APIs.
// Undo itself goes through the normal delete path (useSynced), so it queues offline like any delete.

/** How long the bar stays up. */
export const UNDO_MS = 6000;

export interface Undo {
  kind: "entry" | "coffee";
  /** The row the undo removes. */
  id: string;
  /** "Logged 36 oz", "Logged a coffee". */
  message: string;
  /** Epoch ms after which the bar is gone. */
  until: number;
}

export function makeUndo(kind: Undo["kind"], id: string, message: string, now: number): Undo {
  return { kind, id, message, until: now + UNDO_MS };
}

/** Still inside the window. The bar also goes if the row is already gone (removed by hand). */
export function undoOpen(u: Undo | null, now: number): u is Undo {
  return u !== null && now < u.until;
}

/** "Logged 36 oz", "Logged 36 oz for yesterday", "Logged a coffee". `amount` is already formatted. */
export function undoMessage(what: { amount: string; yesterday?: boolean } | "coffee"): string {
  if (what === "coffee") return "Logged a coffee";
  return `Logged ${what.amount}${what.yesterday ? " for yesterday" : ""}`;
}
