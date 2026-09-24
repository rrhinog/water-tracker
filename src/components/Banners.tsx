"use client";

import { useEffect, useState } from "react";
import { isNewRelease } from "@/lib/health";
import { useCalm } from "@/lib/useCalm";

/** How often an open app asks whether a new release is serving (also on return to the app). */
const VERSION_CHECK_MS = 5 * 60_000;

/**
 * True once /api/health reports a different version from the one this page was rendered with
 * (<html data-version>, app/layout.tsx). Not a service-worker update event: public/sw.js is the same
 * file in every release, so the browser never sees a new worker when the app changes.
 */
function useNewRelease(): boolean {
  const [isNew, setIsNew] = useState(false);
  useEffect(() => {
    if (isNew) return;
    const loaded = document.documentElement.dataset.version;
    let stopped = false;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const body = (await res.json()) as { version?: unknown };
        if (!stopped && isNewRelease(loaded, typeof body.version === "string" ? body.version : null)) setIsNew(true);
      } catch {
        // Offline or mid-deploy: ask again later.
      }
    };
    void check();
    const timer = setInterval(check, VERSION_CHECK_MS);
    const onVisible = () => void check();
    window.addEventListener("online", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("online", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isNew]);
  return isNew;
}

/**
 * The strip above every page: "2 drinks waiting to sync" while the server can't be reached, and
 * "New version — tap to reload" once a new release is serving. In the page flow, so it never covers
 * the STAGING bar, the Log button or the tab bar; it only appears or goes while no finger is down
 * (useCalm), so it never moves a button mid-tap. The reload happens only when the banner is tapped.
 */
export default function Banners({ offline }: { offline?: string | null }) {
  const note = useCalm(offline ?? null);
  const update = useCalm(useNewRelease());
  if (!note && !update) return null;
  return (
    <div className="app-banners">
      {update && (
        <button type="button" className="app-banner app-banner--update" onClick={() => window.location.reload()}>
          New version — tap to reload
        </button>
      )}
      {note && (
        <p className="app-banner" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
