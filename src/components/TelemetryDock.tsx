"use client";

import { useEffect, useState } from "react";
import { useUltron } from "@/components/UltronContext";

/* ==================================================================
   TelemetryDock — the hero's in-flow bottom HUD grid (overlap fix:
   this replaces the old position-fixed dock that floated above page
   content). A clean flex-column footer pinned with mt-auto inside
   the hero: border-t border-red-900/40 over near-black glass, four
   equal tactical panels — featured title, mission parameters, the
   live global score index (best-effort public GETs with a graceful
   offline fallback) and the operator console quick-launch.
   ================================================================== */

function openTerminal(): void {
  window.dispatchEvent(new CustomEvent("vortex:open-terminal"));
}

function ArrowRight({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <path d="M4 12h15M13 6l6 6-6 6" strokeLinecap="square" />
    </svg>
  );
}

export function TelemetryDock() {
  const { ultron } = useUltron();
  const [counter, setCounter] = useState<{ index: number; pilots: number; titles: number } | null>(null);
  const [tick, setTick] = useState(0);

  /* live global score counters — best-effort read of the public GETs */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [healthRes, boardRes] = await Promise.all([
          fetch("/api/health").then((r) => (r.ok ? r.json() : null)),
          fetch("/api/leaderboard/neon-snake").then((r) => (r.ok ? r.json() : null)),
        ]);
        if (!alive) return;
        const entries: Array<{ score?: number }> = Array.isArray(boardRes?.entries) ? boardRes.entries : [];
        const index = entries.reduce((sum, e) => sum + (Number(e.score) || 0), 0);
        setCounter({
          index,
          pilots: Number(healthRes?.players) || 0,
          titles: Number(healthRes?.games) || 16,
        });
        setTick((t) => t + 1);
      } catch {
        if (alive) setCounter(null); // keep the offline fallback
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const synced = counter !== null;

  return (
    <footer className="relative z-20 mt-auto border-t border-red-900/40 bg-[#030305]/95 p-4 backdrop-blur-md">
      <div className="mx-auto grid max-w-[110rem] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* panel 1 — featured title */}
        {/* /index.html is the static arcade shell in /public — not an App Router page */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/index.html"
          className="ultron-frame group px-4 py-3.5 transition hover:bg-black/70 hover:shadow-[0_0_28px_rgba(255,0,85,0.2)]"
        >
          <p className="ultron-label text-[8px] font-bold tracking-[0.3em]">
            FEATURED TITLE <span className="hud-accent">{"//"}</span> 01
          </p>
          <p className="mt-2 font-display text-sm font-bold uppercase tracking-[0.14em] text-white transition group-hover:text-[#ff5c8a]">
            NEON SNAKE
          </p>
          <p className="mt-1.5 flex items-center gap-2 font-[JetBrains_Mono,monospace] text-[9px] font-bold uppercase tracking-[0.18em] hud-accent">
            <span className="status-dot" />
            ACTION / ARCADE - GRID LIVE
          </p>
        </a>

        {/* panel 2 — mission parameters */}
        <div className="ultron-frame px-4 py-3.5">
          <p className="ultron-label text-[8px] font-bold tracking-[0.3em]">MISSION PARAMETERS</p>
          <p className="mt-2 font-display text-sm font-bold uppercase tracking-[0.1em] text-white">
            {ultron ? "REPEL THE ULTRON TAKEOVER" : "SEIZE THE ULTRON CORE"}
          </p>
          <p className="mt-1.5 font-[JetBrains_Mono,monospace] text-[9px] font-bold uppercase tracking-[0.16em] text-[#64748b]">
            {"PRIORITY: OMEGA // REWARD: XP x2"}
          </p>
        </div>

        {/* panel 3 — live global score index */}
        <div className="ultron-frame px-4 py-3.5">
          <p className="ultron-label flex items-center gap-2 text-[8px] font-bold tracking-[0.3em]">
            {ultron ? <span className="status-dot" /> : <span className="status-dot-cyan" />}
            LIVE GLOBAL SCORE INDEX
          </p>
          <p
            key={tick}
            className={`mt-1 font-[JetBrains_Mono,monospace] text-lg font-bold tracking-[0.12em] text-white ${
              synced ? "score-tick" : ""
            }`}
          >
            {synced ? counter.index.toLocaleString("en-IN") : "—"}
          </p>
          <p className="mt-0.5 font-[JetBrains_Mono,monospace] text-[9px] font-bold uppercase tracking-[0.16em] text-[#64748b]">
            {synced ? `${counter.titles} TITLES // SYNC OK` : "16 TITLES // SYNC PENDING"}
          </p>
        </div>

        {/* panel 4 — operator console */}
        <button
          type="button"
          onClick={openTerminal}
          className="ultron-frame group px-4 py-3.5 text-left transition hover:bg-black/70 hover:shadow-[0_0_28px_rgba(255,0,85,0.2)]"
        >
          <p className="ultron-label text-[8px] font-bold tracking-[0.3em]">OPERATOR CONSOLE</p>
          <p className="mt-2 font-display text-sm font-bold uppercase tracking-[0.14em] text-white transition group-hover:text-[#ff5c8a]">
            ADMIN TERMINAL
          </p>
          <p className="mt-1.5 flex items-center gap-2 font-[JetBrains_Mono,monospace] text-[9px] font-bold uppercase tracking-[0.18em] hud-accent">
            HOTKEY
            <kbd className="border border-red-900/60 bg-black/60 px-1 text-[8px] text-[#e2e8f0]">~</kbd>
            {"//"}
            <kbd className="border border-red-900/60 bg-black/60 px-1 text-[8px] text-[#e2e8f0]">CTRL+K</kbd>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
          </p>
        </button>
      </div>
    </footer>
  );
}
