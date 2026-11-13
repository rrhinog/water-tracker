import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, settings } from "@/db";
import { normalizeSettings, settingsForSave } from "@/lib/settings";

export const dynamic = "force-dynamic";
const KEY = "app";

/** Current settings, or the defaults if none were ever saved. */
export async function GET() {
  const rows = await getDb().select().from(settings).where(eq(settings.key, KEY));
  return NextResponse.json(normalizeSettings(rows[0]?.value));
}

/**
 * Replace the settings. The body is normalized, so a bad field can never poison the row. The fields
 * 1.x kept in the same row are carried over from the stored row (settingsForSave), read and written
 * in one transaction with the row locked, so a rollback to 1.9.1 still finds them.
 */
export async function PUT(req: Request) {
  const body: unknown = await req.json();
  const value = await getDb().transaction(async (tx) => {
    const rows = await tx.select().from(settings).where(eq(settings.key, KEY)).for("update");
    const next = settingsForSave(body, rows[0]?.value);
    await tx
      .insert(settings)
      .values({ key: KEY, value: next, updatedAt: new Date() })
      .onConflictDoUpdate({ target: settings.key, set: { value: next, updatedAt: new Date() } });
    return next;
  });
  return NextResponse.json(normalizeSettings(value));
}
