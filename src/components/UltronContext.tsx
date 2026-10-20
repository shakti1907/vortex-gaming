"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/* ==================================================================
   UltronContext — global "system override" takeover state.
   The shell always runs the crimson Biomech OS palette; when the
   override is engaged the wrapper flips to data-ultron="on" and the
   whole HUD burns hotter (CSS vars in globals.css): brighter accent,
   stronger glow, visible tactical grid and live glitch cuts on the
   hero type. Persisted per-browser.
   ================================================================== */

export type UltronState = {
  /** True while the Ultron takeover is active. */
  ultron: boolean;
  /** Force the override state on or off (used by /ultron on|off). */
  setOverride: (on: boolean) => void;
  /** Flip the override state (used by the OVERRIDE SYSTEM button). */
  toggleOverride: () => void;
};

const STORAGE_KEY = "vg_ultron_override";

const UltronContext = createContext<UltronState | null>(null);

/* ---------------- localStorage-backed external store ---------------
   useSyncExternalStore keeps the override in sync across every
   consumer (and across browser tabs via `storage` events) without a
   mount-time setState cascade. The server snapshot renders the
   nominal state, so SSR markup never mismatches hydrated clients. */

let listeners: Array<() => void> = [];

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
    window.removeEventListener("storage", listener);
  };
}

function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

function writeOverride(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    /* storage blocked — state stays in-memory for this session */
  }
  emit();
}

export function UltronProvider({ children }: { children: ReactNode }) {
  const ultron = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setOverride = useCallback((on: boolean) => {
    writeOverride(on);
  }, []);

  const toggleOverride = useCallback(() => {
    writeOverride(!getSnapshot());
  }, []);

  const value = useMemo<UltronState>(
    () => ({ ultron, setOverride, toggleOverride }),
    [ultron, setOverride, toggleOverride],
  );

  return (
    <UltronContext.Provider value={value}>
      <div
        data-ultron={ultron ? "on" : "off"}
        className="relative min-h-screen overflow-x-hidden bg-[#050508] font-[JetBrains_Mono,monospace] text-[#f8fafc]"
      >
        {children}
      </div>
    </UltronContext.Provider>
  );
}

export function useUltron(): UltronState {
  const ctx = useContext(UltronContext);
  if (!ctx) throw new Error("useUltron must be used inside <UltronProvider>");
  return ctx;
}
