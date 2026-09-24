"use client";

// One hook owns the data: local cache for instant render, server for truth across devices.
import { useEffect, useState } from "react";
import type { CoffeeEntry } from "./coffee";
import type { Entry } from "./log";
import { DEFAULT_ACCENT, isTheme } from "./color";
import type { Settings } from "./settings";
import { loadCoffee, loadEntries, loadSettings, saveCoffee, saveEntries, saveSettings } from "./storage";
import { mergeWithServer } from "./merge";
import { fetchCoffee, fetchEntries, fetchSettings, flushPending, loadPending, putSettings, sendOrQueue } from "./sync";

export type SyncState = "loading" | "synced" | "offline";
export type SaveState = "idle" | "saving" | "saved" | "failed";

export function useSynced() {
  const [entries, setEntries] = useState<Entry[]>(loadEntries);
  const [coffees, setCoffees] = useState<CoffeeEntry[]>(loadCoffee);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [settingsSave, setSettingsSave] = useState<SaveState>("idle");
  const [settingsSavedAt, setSettingsSavedAt] = useState<Date | null>(null);
  const [sync, setSync] = useState<SyncState>("loading");
  const [pending, setPending] = useState<number>(() => loadPending().length);

  // The accent is a CSS variable on <html>; pages read it through the kit classes.
  useEffect(() => {
    const root = document.documentElement.style;
    if (isTheme(settings.accent)) {
      // A named theme carries light and dark shades; the stylesheet picks by colour scheme.
      root.removeProperty("--ink-signal");
      root.removeProperty("--ink-on-signal");
      document.documentElement.dataset.accent = settings.accent;
      return;
    }
    delete document.documentElement.dataset.accent;
    if (settings.accent === DEFAULT_ACCENT) {
      // Default = the ink itself, in whichever theme; let the stylesheet decide.
      root.removeProperty("--ink-signal");
      root.removeProperty("--ink-on-signal");
    } else {
      root.setProperty("--ink-signal", settings.accent);
      root.setProperty("--ink-on-signal", "#ffffff");
    }
  }, [settings.accent]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1. Retry anything queued from an earlier offline tap.
        await flushPending();
        // 2. Pull the server's view.
        const [serverEntries, serverCoffee, serverSettings] = await Promise.all([fetchEntries(), fetchCoffee(), fetchSettings()]);
        if (cancelled) return;
        setSettings(serverSettings);
        saveSettings(serverSettings);
        // 3. The server wins. Rows only this device has survive only while still queued to send;
        //    anything else was deleted elsewhere and must not be re-uploaded (see merge.ts).
        const queued = loadPending();
        const mergedEntries = mergeWithServer(serverEntries, loadEntries(), queued, "entry");
        const mergedCoffee = mergeWithServer(serverCoffee, loadCoffee(), queued, "coffee");
        if (cancelled) return;
        setEntries(mergedEntries);
        saveEntries(mergedEntries);
        setCoffees(mergedCoffee);
        saveCoffee(mergedCoffee);
        setPending(loadPending().length);
        setSync("synced");
      } catch {
        if (!cancelled) setSync("offline");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function track(ok: Promise<boolean>) {
    const sent = await ok;
    setPending(loadPending().length);
    setSync(sent ? "synced" : "offline");
  }

  return {
    entries,
    coffees,
    settings,
    sync,
    pending,
    settingsSave,
    settingsSavedAt,
    /** Called from the Settings page's Save button: applies locally and writes to the server. */
    updateSettings(next: Settings) {
      setSettings(next);
      saveSettings(next);
      setSettingsSave("saving");
      void putSettings(next).then((ok) => {
        setSettingsSave(ok ? "saved" : "failed");
        if (ok) setSettingsSavedAt(new Date());
        setSync(ok ? "synced" : "offline");
      });
    },
    addEntry(entry: Entry) {
      const next = [...entries, entry];
      setEntries(next);
      saveEntries(next);
      void track(sendOrQueue({ kind: "upsert-entry", entry }));
    },
    removeEntry(id: string) {
      const next = entries.filter((e) => e.id !== id);
      setEntries(next);
      saveEntries(next);
      void track(sendOrQueue({ kind: "delete-entry", id }));
    },
    addCoffee(entry: CoffeeEntry) {
      const next = [...coffees, entry];
      setCoffees(next);
      saveCoffee(next);
      void track(sendOrQueue({ kind: "upsert-coffee", entry }));
    },
    updateCoffee(entry: CoffeeEntry) {
      const next = coffees.map((c) => (c.id === entry.id ? entry : c));
      setCoffees(next);
      saveCoffee(next);
      void track(sendOrQueue({ kind: "upsert-coffee", entry }));
    },
    removeCoffee(id: string) {
      const next = coffees.filter((c) => c.id !== id);
      setCoffees(next);
      saveCoffee(next);
      void track(sendOrQueue({ kind: "delete-coffee", id }));
    },
  };
}
