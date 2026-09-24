import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { appVersion, checkHealth } from "@/lib/health";
import pkg from "../../../../package.json";

export const dynamic = "force-dynamic";

/** 200 { ok, version, db } after a trivial query; 503 when the database does not answer. No secrets, ever. */
export async function GET() {
  const { status, body } = await checkHealth(() => getDb().execute(sql`select 1`), appVersion(pkg.version, process.env.GIT_SHA));
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
