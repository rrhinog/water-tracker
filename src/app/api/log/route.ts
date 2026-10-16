import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, settings, waterEntries } from "@/db";
import type { Fraction } from "@/lib/bottles";
import type { Entry } from "@/lib/log";
import { describeDrink, quickLog } from "@/lib/quicklog";
import { normalizeSettings, SETTINGS_ROW } from "@/lib/settings";

export const dynamic = "force-dynamic";

const reply = (status: number, body: object) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Log a drink from an iPhone Shortcut: {"bottle": "Yeti"}, with an optional "fraction" (0.25, 0.5, 0.75
 * or 1), or {"bottle": "Other", "oz": 16.9}; plus an optional "requestId" that makes a retry safe.
 * Every answer carries a "message" the Shortcut can show or Siri can read: 201 logged, 200 already
 * logged (same requestId, nothing written), 400 a request it can't log, 503 no database.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply(400, { ok: false, message: `Send JSON like {"bottle": "Yeti"}.` });
  }
  try {
    const db = getDb();
    const [row] = await db.select().from(settings).where(eq(settings.key, SETTINGS_ROW));
    const s = normalizeSettings(row?.value);
    const r = quickLog(body, s, new Date());
    if (!r.ok) return reply(400, r);
    const e = r.entry;
    // First write wins: the same requestId again finds its drink already there and changes nothing.
    const inserted = await db
      .insert(waterEntries)
      .values({ id: e.id, at: new Date(e.at), source: e.bottleId, fraction: String(e.fraction), oz: String(e.oz), untimed: false })
      .onConflictDoNothing({ target: waterEntries.id })
      .returning({ id: waterEntries.id });
    if (inserted.length > 0) return reply(201, r);
    const [had] = await db.select().from(waterEntries).where(eq(waterEntries.id, e.id));
    const entry: Entry = had
      ? { id: had.id, at: had.at.toISOString(), bottleId: had.source, fraction: Number(had.fraction) as Fraction, oz: Number(had.oz), untimed: had.untimed }
      : e;
    return reply(200, { ok: true, duplicate: true, message: `Already logged ${describeDrink(entry, s)}`, entry });
  } catch (err) {
    console.error(`[log] could not save a drink: ${(err as Error).message}`);
    return reply(503, { ok: false, message: "Not logged: the server can't reach its database. Log it in the app." });
  }
}
