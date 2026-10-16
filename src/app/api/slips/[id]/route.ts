import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, slips } from "@/db";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await getDb().delete(slips).where(eq(slips.id, id));
  return NextResponse.json({ deleted: id });
}
