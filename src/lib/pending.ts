// Words for the offline banner, from the retry queue. Pure, no browser APIs.
import type { Op } from "./sync";

/**
 * "2 drinks waiting to sync", "1 coffee waiting to sync", "1 drink, 2 coffees and 1 slip waiting to sync".
 * Counts rows, not requests: a drink logged and then re-timed offline is one drink waiting. Null when
 * nothing is queued.
 */
export function pendingLabel(ops: readonly Op[]): string | null {
  const drinks = new Set<string>();
  const coffees = new Set<string>();
  const slips = new Set<string>();
  for (const op of ops) {
    if (op.kind === "upsert-entry") drinks.add(op.entry.id);
    else if (op.kind === "delete-entry") drinks.add(op.id);
    else if (op.kind === "upsert-coffee") coffees.add(op.entry.id);
    else if (op.kind === "delete-coffee") coffees.add(op.id);
    else if (op.kind === "upsert-slip") slips.add(op.entry.id);
    else slips.add(op.id);
  }
  const parts = [
    drinks.size > 0 ? `${drinks.size} ${drinks.size === 1 ? "drink" : "drinks"}` : null,
    coffees.size > 0 ? `${coffees.size} ${coffees.size === 1 ? "coffee" : "coffees"}` : null,
    slips.size > 0 ? `${slips.size} ${slips.size === 1 ? "slip" : "slips"}` : null,
  ].filter((p): p is string => p !== null);
  if (parts.length === 0) return null;
  const words = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${words} waiting to sync`;
}

/** The one sync indicator: shown only while the server can't be reached. */
export function offlineNote(offline: boolean, ops: readonly Op[]): string | null {
  if (!offline) return null;
  return pendingLabel(ops) ?? "Can't reach the server";
}
