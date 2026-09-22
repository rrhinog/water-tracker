import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, waterEntries } from "@/db";

export const dynamic = "force-dynamic";

/** All water entries, oldest first. Small enough to send whole (a few rows a day). */
export async function GET() {
  const rows = await getDb().select().from(waterEntries).orderBy(waterEntries.at);
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      at: r.at.toISOString(),
      bottleId: r.source,
      fraction: Number(r.fraction),
      oz: Number(r.oz),
      untimed: r.untimed,
    })),
  );
}

interface Incoming {
  id: string;
  at: string;
  bottleId: string;
  fraction?: number;
  oz: number;
  untimed?: boolean;
}

/** Upsert one entry or an array of them. Same id twice = one row, so retries are safe. */
export async function POST(req: Request) {
  const body = (await req.json()) as Incoming | Incoming[];
  const list = Array.isArray(body) ? body : [body];
  if (list.length === 0) return NextResponse.json({ upserted: 0 });
  const values = list.map((e) => ({
    id: e.id,
    at: new Date(e.at),
    source: e.bottleId,
    fraction: String(e.fraction ?? 1),
    oz: String(e.oz),
    untimed: e.untimed ?? false,
  }));
  await getDb()
    .insert(waterEntries)
    .values(values)
    .onConflictDoUpdate({
      target: waterEntries.id,
      set: { at: sql`excluded.at`, source: sql`excluded.source`, fraction: sql`excluded.fraction`, oz: sql`excluded.oz`, untimed: sql`excluded.untimed` },
    });
  return NextResponse.json({ upserted: values.length });
}
