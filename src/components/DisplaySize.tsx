"use client";

import { useLayoutEffect } from "react";
import { applyDisplay, DISPLAY_KEY, parseDisplay } from "@/lib/display";
import { loadDisplay } from "@/lib/storage";

/**
 * The inline script in app/layout.tsx sets the display size before first paint; that is all a
 * production load needs. This re-applies it where the script cannot reach: React's dev-mode
 * remount resets <html> to the attributes it manages (clearing the script's style), and another
 * tab changing the size fires a storage event here.
 */
export default function DisplaySize() {
  useLayoutEffect(() => {
    applyDisplay(loadDisplay());
    const onStorage = (e: StorageEvent) => {
      if (e.key === DISPLAY_KEY) applyDisplay(parseDisplay(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
