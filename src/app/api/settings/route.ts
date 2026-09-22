import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, settings } from "@/db";
import { normalizeSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
const KEY = "app";

/** Current settings, or the defaults if none were ever saved. */
export async function GET() {
  const rows = await getDb().select().from(settings).where(eq(settings.key, KEY));
  return NextResponse.json(normalizeSettings(rows[0]?.value));
}

/** Replace the settings. The body is normalized, so a bad field can never poison the row. */
export async function PUT(req: Request) {
  const value = normalizeSettings(await req.json());
  await getDb()
    .insert(settings)
    .values({ key: KEY, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  return NextResponse.json(value);
}
