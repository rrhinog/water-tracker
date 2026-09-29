"use client";

// Holds a layout change back while the user is touching the screen. The banners sit above the page,
// so showing or hiding one moves everything under them, the Log button included; if that happens
// between two taps the second one lands on the wrong control. useCalm(value) returns the value as of
// the last quiet moment: no finger down, and no tap or key press for CALM_MS.
import { useEffect, useState } from "react";

export const CALM_MS = 1200;

let pressed = false;
let lastInput = -Infinity;
let listening = false;

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  const down = () => {
    pressed = true;
    lastInput = performance.now();
  };
  const up = () => {
    pressed = false;
    lastInput = performance.now();
  };
  window.addEventListener("pointerdown", down, { capture: true, passive: true });
  window.addEventListener("pointerup", up, { capture: true, passive: true });
  window.addEventListener("pointercancel", up, { capture: true, passive: true });
  window.addEventListener("keydown", up, { capture: true, passive: true });
}

export function useCalm<T>(value: T, quietMs = CALM_MS): T {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    listen();
    if (Object.is(value, shown)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const apply = () => {
      const quiet = performance.now() - lastInput;
      if (!pressed && quiet >= quietMs) setShown(value);
      else timer = setTimeout(apply, pressed ? quietMs : quietMs - quiet);
    };
    timer = setTimeout(apply, 0);
    return () => clearTimeout(timer);
  }, [value, shown, quietMs]);
  return shown;
}
