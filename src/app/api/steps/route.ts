import type { Pool } from "pg";
import { createPool } from "@/db";
import { STEPS_DAYS_BACK, STEPS_VIEW, stepsUrl, toStepsDays, type StepsResponse } from "@/lib/steps";

export const dynamic = "force-dynamic";

// Its own small pool: a different database (and login) from the app's. Created on first use only.
let pool: Pool | null = null;

/** Daily steps from the optional read-only source; { enabled: false } when STEPS_DATABASE_URL is unset. */
export async function GET() {
  const url = stepsUrl(process.env);
  const headers = { "Cache-Control": "no-store" };
  if (!url) return Response.json({ enabled: false } satisfies StepsResponse, { headers });
  pool ??= createPool(url);
  try {
    const { rows } = await pool.query<{ day: string; steps: number; synced_at: Date }>(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, steps, synced_at FROM ${STEPS_VIEW} WHERE day >= current_date - $1::int ORDER BY day`,
      [STEPS_DAYS_BACK],
    );
    return Response.json({ enabled: true, days: toStepsDays(rows) } satisfies StepsResponse, { headers });
  } catch (err) {
    // The message only: never the connection string.
    console.error(`[steps] read failed: ${(err as Error).message}`);
    return Response.json({ enabled: true, error: "steps source unreachable" } satisfies StepsResponse, { status: 503, headers });
  }
}
