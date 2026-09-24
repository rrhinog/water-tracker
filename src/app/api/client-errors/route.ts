import { MAX_BODY_BYTES, createRateLimiter, parseReport } from "@/lib/clientErrors";

export const dynamic = "force-dynamic";

// Per process, so a loop of errors in one open tab cannot flood the log.
const allow = createRateLimiter(20, 60_000);

/** Log one line per browser error and answer 204. Oversized bodies (413) and floods (429) are dropped unlogged. */
export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  const body = await req.text();
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
  if (!allow(Date.now())) return new Response(null, { status: 429 });
  const report = parseReport(body, req.headers.get("user-agent"));
  if (!report) return new Response(null, { status: 400 });
  console.error(`[client-error] ${JSON.stringify(report)}`);
  return new Response(null, { status: 204 });
}
