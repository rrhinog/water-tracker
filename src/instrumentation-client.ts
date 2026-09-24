// Runs before hydration (Next.js convention): report uncaught browser errors to the server log
// via /api/client-errors. Fire-and-forget; offline or failing reports are simply dropped.
import { buildPayload } from "@/lib/clientErrors";

const MAX_PER_PAGE = 10;
const seen = new Set<string>();

function report(reason: unknown, fallbackMessage: string) {
  try {
    const payload = buildPayload(reason, fallbackMessage, location.pathname);
    if (seen.size >= MAX_PER_PAGE || seen.has(payload.message)) return;
    seen.add(payload.message);
    fetch("/api/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Reporting must never become the error.
  }
}

window.addEventListener("error", (e) => report(e.error, e.message));
window.addEventListener("unhandledrejection", (e) => report(e.reason, "Unhandled promise rejection"));
