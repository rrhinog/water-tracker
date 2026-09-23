import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { coffeeEntries, getDb } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await getDb().select().from(coffeeEntries).orderBy(coffeeEntries.at);
  return NextResponse.json(
    rows.map((r) => ({ id: r.id, at: r.at.toISOString(), fromNotes: r.fromNotes, finishedAt: r.finishedAt ? r.finishedAt.toISOString() : undefined })),
  );
}

interface Incoming {
  id: string;
  at: string;
  fromNotes?: boolean;
  finishedAt?: string | null;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Incoming | Incoming[];
  const list = Array.isArray(body) ? body : [body];
  if (list.length === 0) return NextResponse.json({ upserted: 0 });
  await getDb()
    .insert(coffeeEntries)
    .values(list.map((c) => ({ id: c.id, at: new Date(c.at), fromNotes: c.fromNotes ?? false, finishedAt: c.finishedAt ? new Date(c.finishedAt) : null })))
    .onConflictDoUpdate({
      target: coffeeEntries.id,
      set: { at: sql`excluded.at`, fromNotes: sql`excluded.from_notes`, finishedAt: sql`excluded.finished_at` },
    });
  return NextResponse.json({ upserted: list.length });
}
