// Words for the offline banner, from the retry queue. Pure, no browser APIs.
import type { Op } from "./sync";

/**
 * "2 drinks waiting to sync", "1 coffee waiting to sync", "1 drink and 2 coffees waiting to sync".
 * Counts rows, not requests: a drink logged and then re-timed offline is one drink waiting. Null when
 * nothing is queued.
 */
export function pendingLabel(ops: readonly Op[]): string | null {
  const drinks = new Set<string>();
  const coffees = new Set<string>();
  for (const op of ops) {
    if (op.kind === "upsert-entry") drinks.add(op.entry.id);
    else if (op.kind === "delete-entry") drinks.add(op.id);
    else if (op.kind === "upsert-coffee") coffees.add(op.entry.id);
    else coffees.add(op.id);
  }
  const parts = [
    drinks.size > 0 ? `${drinks.size} ${drinks.size === 1 ? "drink" : "drinks"}` : null,
    coffees.size > 0 ? `${coffees.size} ${coffees.size === 1 ? "coffee" : "coffees"}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? `${parts.join(" and ")} waiting to sync` : null;
}

/** The one sync indicator: shown only while the server can't be reached. */
export function offlineNote(offline: boolean, ops: readonly Op[]): string | null {
  if (!offline) return null;
  return pendingLabel(ops) ?? "Can't reach the server";
}
