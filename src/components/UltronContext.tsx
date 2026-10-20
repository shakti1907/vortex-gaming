"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/* ==================================================================
   UltronContext — global "system override" corruption state.
   When the override is active the wrapper flips to data-ultron="on"
   and every HUD accent (CSS vars in globals.css) shifts from cyber
   cyan to deep corrupted crimson. Persisted per-browser.
   ================================================================== */

export type UltronState = {
  /** True while the Ultron takeover is active. */
  ultron: boolean;
  /** Force the corruption state on or off (used by /ultron on|off). */
  setOverride: (on: boolean) => void;
  /** Flip the corruption state (used by the OVERRIDE SYSTEM button). */
  toggleOverride: () => void;
};

const STORAGE_KEY = "vg_ultron_override";

const UltronContext = createContext<UltronState | null>(null);

function readPersisted(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persist(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    /* storage blocked — state stays in-memory */
  }
}

export function UltronProvider({ children }: { children: ReactNode }) {
  const [ultron, setUltron] = useState(false);

  /* restore the persisted override once on mount */
  useEffect(() => {
    if (readPersisted()) setUltron(true);
  }, []);

  const setOverride = useCallback((on: boolean) => {
    setUltron(on);
    persist(on);
  }, []);

  const toggleOverride = useCallback(() => {
    setUltron((prev) => {
      const next = !prev;
      persist(next);
      return next;
    });
  }, []);

  const value = useMemo<UltronState>(
    () => ({ ultron, setOverride, toggleOverride }),
    [ultron, setOverride, toggleOverride],
  );

  return (
    <UltronContext.Provider value={value}>
      <div
        data-ultron={ultron ? "on" : "off"}
        className="relative min-h-screen overflow-x-hidden bg-[#020105] font-[Rajdhani,sans-serif] text-[#e8ecf5]"
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
