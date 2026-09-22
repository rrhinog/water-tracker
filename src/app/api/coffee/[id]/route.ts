import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { coffeeEntries, getDb } from "@/db";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await getDb().delete(coffeeEntries).where(eq(coffeeEntries.id, id));
  return NextResponse.json({ deleted: id });
}
