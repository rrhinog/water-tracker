import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, slips } from "@/db";

export const dynamic = "force-dynamic";

/** Every slip, oldest first. A few rows a week at most, so it is sent whole like coffee. */
export async function GET() {
  const rows = await getDb().select().from(slips).orderBy(slips.at);
  return NextResponse.json(
    rows.map((r) => ({ id: r.id, vice: r.vice, at: r.at.toISOString(), kind: r.kind ?? undefined, fromNotes: r.fromNotes || undefined })),
  );
}

interface Incoming {
  id: string;
  vice: string;
  at: string;
  kind?: string | null;
  fromNotes?: boolean;
}

/** Upsert one slip or an array of them. Same id twice = one row, so retries are safe. */
export async function POST(req: Request) {
  const body = (await req.json()) as Incoming | Incoming[];
  const list = Array.isArray(body) ? body : [body];
  if (list.some((s) => typeof s?.id !== "string" || !s.id || typeof s.vice !== "string" || !s.vice || Number.isNaN(Date.parse(s.at)))) {
    return NextResponse.json({ error: "each slip needs an id, a vice and a time" }, { status: 400 });
  }
  if (list.length === 0) return NextResponse.json({ upserted: 0 });
  await getDb()
    .insert(slips)
    .values(list.map((s) => ({ id: s.id, vice: s.vice, at: new Date(s.at), kind: s.kind ?? null, fromNotes: s.fromNotes ?? false })))
    .onConflictDoUpdate({
      target: slips.id,
      set: { vice: sql`excluded.vice`, at: sql`excluded.at`, kind: sql`excluded.kind`, fromNotes: sql`excluded.from_notes` },
    });
  return NextResponse.json({ upserted: list.length });
}
