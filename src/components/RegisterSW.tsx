"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js. Browsers only allow service workers on a secure origin
 * (HTTPS, or localhost), so on the plain-HTTP Tailscale IP this does nothing and the app
 * behaves exactly as before. Skipped in development so hot reload is never served stale.
 */
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Offline launch is a bonus; the app works without it.
    });
  }, []);
  return null;
}
