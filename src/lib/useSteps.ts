"use client";

// Steps for the Floors card: the last rows the server sent (cached on this device), refreshed once on
// load. Kept apart from useSynced on purpose: a steps source that is down never makes the app "offline".
import { useEffect, useState } from "react";
import type { StepsResponse } from "./steps";
import { loadSteps, saveSteps } from "./storage";
import type { StepsDay } from "./vices";

export function useSteps(): { days: StepsDay[]; enabled: boolean; unreachable: boolean } {
  const [days, setDays] = useState<StepsDay[]>(loadSteps);
  // Until the server answers, a device that has cached steps keeps showing them.
  const [enabled, setEnabled] = useState(() => loadSteps().length > 0);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/steps", { cache: "no-store" })
      .then((res) => res.json() as Promise<StepsResponse>)
      .then((body) => {
        if (cancelled) return;
        if (!body.enabled) {
          setEnabled(false);
          setDays([]);
          saveSteps([]);
        } else if ("days" in body) {
          setEnabled(true);
          setUnreachable(false);
          setDays(body.days);
          saveSteps(body.days);
        } else {
          setEnabled(true);
          setUnreachable(true);
        }
      })
      .catch(() => {
        if (!cancelled) setUnreachable(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { days, enabled, unreachable };
}
