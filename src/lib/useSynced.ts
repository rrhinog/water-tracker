"use client";

// One hook owns the data: local cache for instant render, server for truth across devices.
import { useCallback, useEffect, useRef, useState } from "react";
import type { CoffeeEntry } from "./coffee";
import { byTime, type Entry } from "./log";
import { DEFAULT_ACCENT, isTheme } from "./color";
import type { Settings } from "./settings";
import { loadCoffee, loadEntries, loadSettings, saveCoffee, saveEntries, saveSettings } from "./storage";
import { mergeWithServer } from "./merge";
import { offlineNote } from "./pending";
import { fetchCoffee, fetchEntries, fetchSettings, flushPending, loadPending, putSettings, sendOrQueue, type Op } from "./sync";

/** How often to retry while the server can't be reached (also retried on `online` and on return to the app). */
const RETRY_MS = 15_000;

export type SyncState = "loading" | "synced" | "offline";
export type SaveState = "idle" | "saving" | "saved" | "failed";

export function useSynced() {
  const [entries, setEntries] = useState<Entry[]>(loadEntries);
  const [coffees, setCoffees] = useState<CoffeeEntry[]>(loadCoffee);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [settingsSave, setSettingsSave] = useState<SaveState>("idle");
  const [settingsSavedAt, setSettingsSavedAt] = useState<Date | null>(null);
  const [sync, setSync] = useState<SyncState>("loading");
  const [queue, setQueue] = useState<Op[]>(loadPending);
  // A Settings save the server never got: sent again before the next pull, or the pull would undo it.
  const settingsUnsent = useRef(false);

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

  // Flush the queue, then pull the server's view. Runs on load and again whenever a retry is due.
  const refresh = useCallback(async (isCancelled: () => boolean = () => false) => {
    try {
      // 1. Send anything queued from an earlier offline tap, in order, and a Save that failed.
      await flushPending();
      if (settingsUnsent.current) {
        if (!(await putSettings(loadSettings()))) throw new Error("settings still unsent");
        settingsUnsent.current = false;
        setSettingsSave("saved");
        setSettingsSavedAt(new Date());
      }
      // 2. Pull the server's view.
      const [serverEntries, serverCoffee, serverSettings] = await Promise.all([fetchEntries(), fetchCoffee(), fetchSettings()]);
      if (isCancelled()) return;
      setSettings(serverSettings);
      saveSettings(serverSettings);
      // 3. The server wins. Rows only this device has survive only while still queued to send;
      //    anything else was deleted elsewhere and must not be re-uploaded (see merge.ts).
      const queued = loadPending();
      const mergedEntries = mergeWithServer(serverEntries, loadEntries(), queued, "entry");
      const mergedCoffee = mergeWithServer(serverCoffee, loadCoffee(), queued, "coffee");
      setEntries(mergedEntries);
      saveEntries(mergedEntries);
      setCoffees(mergedCoffee);
      saveCoffee(mergedCoffee);
      setQueue(queued);
      setSync(queued.length === 0 ? "synced" : "offline");
    } catch {
      if (!isCancelled()) {
        setQueue(loadPending());
        setSync("offline");
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Started from a microtask: refresh sets state, and an effect must not do that synchronously.
    void Promise.resolve().then(() => refresh(() => cancelled));
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // While the server can't be reached, keep trying: now and then, when the network comes back, and
  // when the app comes back to the foreground (a phone suspends timers in the background).
  useEffect(() => {
    if (sync !== "offline") return;
    const retry = () => void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    const timer = setInterval(retry, RETRY_MS);
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sync, refresh]);

  async function track(ok: Promise<boolean>) {
    const sent = await ok;
    setQueue(loadPending());
    setSync(sent ? "synced" : "offline");
  }

  // Functional updates: a refresh can land between a render and a tap, and must not be overwritten.
  function changeEntries(f: (prev: Entry[]) => Entry[]) {
    setEntries((prev) => {
      const next = f(prev);
      saveEntries(next);
      return next;
    });
  }
  function changeCoffees(f: (prev: CoffeeEntry[]) => CoffeeEntry[]) {
    setCoffees((prev) => {
      const next = f(prev);
      saveCoffee(next);
      return next;
    });
  }

  return {
    entries,
    coffees,
    settings,
    sync,
    pending: queue.length,
    /** The one sync indicator ("2 drinks waiting to sync"); null while the server is reachable. */
    offline: offlineNote(sync === "offline", queue),
    settingsSave,
    settingsSavedAt,
    /** Called from the Settings page's Save button: applies locally and writes to the server. */
    updateSettings(next: Settings) {
      setSettings(next);
      saveSettings(next);
      setSettingsSave("saving");
      void putSettings(next).then((ok) => {
        setSettingsSave(ok ? "saved" : "failed");
        settingsUnsent.current = !ok;
        if (ok) setSettingsSavedAt(new Date());
        setSync(ok ? "synced" : "offline");
      });
    },
    /** Adds a drink (now, or an earlier time such as yesterday evening); the list stays in time order. */
    addEntry(entry: Entry) {
      changeEntries((prev) => byTime([...prev, entry]));
      void track(sendOrQueue({ kind: "upsert-entry", entry }));
    },
    /** Same id, new fields (an edited time): sent as an upsert, so the server row is replaced. */
    updateEntry(entry: Entry) {
      changeEntries((prev) => byTime(prev.map((e) => (e.id === entry.id ? entry : e))));
      void track(sendOrQueue({ kind: "upsert-entry", entry }));
    },
    removeEntry(id: string) {
      changeEntries((prev) => prev.filter((e) => e.id !== id));
      void track(sendOrQueue({ kind: "delete-entry", id }));
    },
    addCoffee(entry: CoffeeEntry) {
      changeCoffees((prev) => [...prev, entry]);
      void track(sendOrQueue({ kind: "upsert-coffee", entry }));
    },
    updateCoffee(entry: CoffeeEntry) {
      changeCoffees((prev) => prev.map((c) => (c.id === entry.id ? entry : c)));
      void track(sendOrQueue({ kind: "upsert-coffee", entry }));
    },
    removeCoffee(id: string) {
      changeCoffees((prev) => prev.filter((c) => c.id !== id));
      void track(sendOrQueue({ kind: "delete-coffee", id }));
    },
  };
}
