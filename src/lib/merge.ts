// How a device's cache is reconciled with the server on load. Pure, so it is unit-testable.
//
// The server is the truth. A row that exists only on this device is kept only while it is still
// waiting in the retry queue (logged offline, not yet sent). Anything else missing from the server
// was deleted elsewhere (another device, or a backfill) and must not come back.
import type { Op } from "./sync";

type Row = { id: string; at: string };

export function mergeWithServer<T extends Row>(server: readonly T[], local: readonly T[], pending: readonly Op[], kind: "entry" | "coffee"): T[] {
  const upserts = new Set<string>();
  const deletes = new Set<string>();
  for (const op of pending) {
    if (op.kind === `upsert-${kind}`) upserts.add((op as { entry: Row }).entry.id);
    if (op.kind === `delete-${kind}`) deletes.add((op as { id: string }).id);
  }
  const onServer = new Set(server.map((r) => r.id));
  const unsent = local.filter((r) => !onServer.has(r.id) && upserts.has(r.id));
  // A change still queued (an edited time, a finished coffee) beats the server's older copy.
  const localById = new Map(local.map((r) => [r.id, r]));
  const kept = server.map((r) => (upserts.has(r.id) && localById.get(r.id)) || r);
  // A delete tapped offline should not flash back in while it waits to be sent.
  return [...kept.filter((r) => !deletes.has(r.id)), ...unsent].sort((a, b) => a.at.localeCompare(b.at));
}
