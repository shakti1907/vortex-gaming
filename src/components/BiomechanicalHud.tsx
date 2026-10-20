"use client";

import { useEffect, useState } from "react";
import { useUltron } from "@/components/UltronContext";

/* ==================================================================
   BiomechanicalHud — sticky top bar, side rails and bottom telemetry
   dock around the hero canvas:
     · sticky glass nav — "VORTEX // BIOMECH OS" brand mark, links
       (Games · Leaderboard · Ultron Core · Terminal), live OVERRIDE
       SYSTEM button in angled crimson
     · left rail: vertical FOLLOW US + status icons
     · right rail: numeric slide indicators 01–04 (monospace)
     · bottom dock: .ultron-frame tiles with // telemetry labels —
       featured titles, mission parameters, live global score counters
   Decoration frames are pointer-events-none; only real controls
   re-enable pointer events so gameplay input is never intercepted.
   ================================================================== */

function openTerminal(): void {
  window.dispatchEvent(new CustomEvent("vortex:open-terminal"));
}

/* brand emblem — angular obsidian shard with a crimson core */
function Brandmark() {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden>
      <polygon points="20,2 37,11 37,29 20,38 3,29 3,11" fill="#0a0f16" stroke="var(--hud-accent)" strokeWidth="2" />
      <polygon points="20,10 29,15 29,25 20,30 11,25 11,15" fill="none" stroke="#ff0055" strokeWidth="1.6" />
      <circle cx="20" cy="20" r="3.4" fill="var(--hud-accent)" />
    </svg>
  );
}

function SocialIcon({ label, href, path }: { label: string; href: string; path: string }) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noreferrer"
      className="pointer-events-auto grid h-9 w-9 place-items-center border border-white/10 bg-white/5 text-[#64748b] transition hover:border-[color:var(--hud-accent-line)] hover:text-[#f8fafc]"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d={path} />
      </svg>
    </a>
  );
}

export function BiomechanicalHud() {
  const { ultron, toggleOverride } = useUltron();
  const [slide, setSlide] = useState(1);
  const [counter, setCounter] = useState<{ index: number; pilots: number; titles: number } | null>(null);

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
      } catch {
        if (alive) setCounter(null); // keep the offline fallback
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      {/* ================= STICKY NAVIGATION HEADER ================= */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
        <div className="pointer-events-auto mx-auto flex max-w-[110rem] items-center gap-4 border border-[color:var(--hud-accent-line)] bg-[#0a0f16]/85 px-4 py-2.5 backdrop-blur-md">
          <a href="/" className="flex items-center gap-3">
            <Brandmark />
            <div className="leading-none">
              <p className="font-[JetBrains_Mono,monospace] text-sm font-black uppercase tracking-[0.3em] text-[#f8fafc]">
                VORTEX <span className="hud-accent">//</span> BIOMECH OS
              </p>
              <p className="ultron-label mt-1 text-[8px] tracking-[0.34em]">
                BIOMECHANICAL COMMAND CORE
              </p>
            </div>
          </a>

          <nav className="ml-6 hidden items-center gap-7 font-[JetBrains_Mono,monospace] text-[11px] font-bold uppercase tracking-[0.26em] text-[#64748b] md:flex">
            <a href="/index.html" className="transition hover:text-[#00f3ff]">
              Games
            </a>
            <a href="/index.html" className="transition hover:text-[#00f3ff]">
              Leaderboard
            </a>
            <a href="#ultron-core" className="transition hover:text-[#00f3ff]">
              Ultron Core
            </a>
            <button type="button" onClick={openTerminal} className="transition hover:text-[#00f3ff]">
              Terminal
            </button>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="ultron-label hidden items-center gap-2 text-[9px] tracking-[0.22em] sm:flex">
              <span className="status-dot" />
              {ultron ? "OVERRIDE // ON" : "OVERRIDE // OFF"}
            </span>
            <button
              type="button"
              onClick={toggleOverride}
              aria-pressed={ultron}
              className="btn-ultron-primary px-6 py-2.5 text-[11px]"
            >
              {ultron ? "RESTORE SYSTEM ↗" : "OVERRIDE SYSTEM ↗"}
            </button>
          </div>
        </div>
      </header>

      {/* ================= LEFT RAIL — FOLLOW US ================= */}
      <aside
        aria-label="Social links"
        className="fixed left-3 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-5 xl:flex"
      >
        <span className="vertical-rl ultron-label text-[10px] font-bold tracking-[0.5em]">
          FOLLOW US
        </span>
        <span className="h-10 w-px bg-white/15" />
        <SocialIcon
          label="X"
          href="https://x.com"
          path="M18.9 2H22l-6.8 7.8L23.3 22h-6.5l-5.1-6.6L5.8 22H2.7l7.3-8.3L1.5 2h6.6l4.6 6L18.9 2Zm-1.1 18h1.7L7.1 3.9H5.3L17.8 20Z"
        />
        <SocialIcon
          label="Discord"
          href="https://discord.com"
          path="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.4c1.6.4 2.4 1 3.2 1.7a13.7 13.7 0 0 0-10.8 0C8.4 4.4 9.3 3.8 10.8 3.4L10.6 3a19.8 19.8 0 0 0-4.9 1.4C2.8 8.7 2 12.9 2.4 17c1.8 1.4 3.6 2.2 5.3 2.7l1-1.6c-.9-.3-1.7-.7-2.5-1.3l.6-.5c2.4 1.1 5 1.7 7.6 1.7s5.2-.6 7.6-1.7l.6.5c-.8.6-1.6 1-2.5 1.3l1 1.6c1.7-.5 3.5-1.3 5.3-2.7.5-4.8-.8-9-3-12.6ZM9.3 14.6c-.9 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.8 1.9-1.7 1.9Zm5.4 0c-.9 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.8 1.9-1.7 1.9Z"
        />
        <SocialIcon
          label="YouTube"
          href="https://youtube.com"
          path="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.8 15.3V8.7l5.7 3.3-5.7 3.3Z"
        />
      </aside>

      {/* ================= RIGHT RAIL — SLIDE INDICATORS ================= */}
      <aside
        aria-label="Slide indicators"
        className="fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-4 xl:flex"
      >
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setSlide(n)}
            aria-label={`Slide ${n}`}
            aria-current={slide === n}
            className={`pointer-events-auto font-[JetBrains_Mono,monospace] text-[11px] tracking-[0.2em] transition ${
              slide === n ? "hud-accent scale-110" : "text-[#334155] hover:text-[#64748b]"
            }`}
          >
            {String(n).padStart(2, "0")}
            <span
              className={`mx-auto mt-1 block h-px transition-all ${
                slide === n ? "w-5 hud-accent-bg" : "w-2 bg-white/20"
              }`}
            />
          </button>
        ))}
      </aside>

      {/* ================= BOTTOM HUD DOCK ================= */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-3">
        <div className="mx-auto grid max-w-[110rem] grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {/* tile 1 — featured title */}
          <a href="/index.html" className="ultron-frame pointer-events-auto px-4 py-3 transition hover:bg-black/85">
            <p className="ultron-label text-[8px] font-bold tracking-[0.3em]">
              FEATURED TITLE // 01
            </p>
            <p className="mt-1.5 font-[JetBrains_Mono,monospace] text-sm font-bold uppercase tracking-[0.12em] text-[#f8fafc]">
              NEON SNAKE
            </p>
            <p className="mt-1 font-[JetBrains_Mono,monospace] text-[9px] uppercase tracking-[0.16em] hud-accent">
              ACTION / ARCADE — GRID LIVE
            </p>
          </a>

          {/* tile 2 — mission parameters */}
          <div className="ultron-frame px-4 py-3">
            <p className="ultron-label text-[8px] font-bold tracking-[0.3em]">
              MISSION // PARAMETERS
            </p>
            <p className="mt-1.5 text-sm font-semibold uppercase tracking-wide text-[#f8fafc]">
              {ultron ? "REPEL THE ULTRON TAKEOVER" : "SEIZE THE ULTRON CORE"}
            </p>
            <p className="mt-1 font-[JetBrains_Mono,monospace] text-[9px] uppercase tracking-[0.16em] text-[#64748b]">
              PRIORITY: OMEGA // REWARD: XP ×2
            </p>
          </div>

          {/* tile 3 — live global score index */}
          <div className="ultron-frame px-4 py-3">
            <p className="ultron-label flex items-center gap-2 text-[8px] font-bold tracking-[0.3em]">
              <span className="status-dot" />
              LIVE GLOBAL SCORE INDEX
            </p>
            <p className="mt-1.5 font-[JetBrains_Mono,monospace] text-lg font-bold tracking-[0.12em] text-[#f8fafc]">
              {counter ? counter.index.toLocaleString("en-IN") : "—"}
            </p>
            <p className="mt-0.5 font-[JetBrains_Mono,monospace] text-[9px] uppercase tracking-[0.16em] text-[#64748b]">
              {counter
                ? `${counter.pilots > 0 ? counter.pilots + " PILOTS // " : ""}${counter.titles} TITLES // STATUS // STABLE`
                : "AWAITING TELEMETRY LINK…"}
            </p>
          </div>

          {/* tile 4 — terminal call */}
          <button
            type="button"
            onClick={openTerminal}
            className="ultron-frame pointer-events-auto px-4 py-3 text-left transition hover:bg-black/85"
          >
            <p className="ultron-label text-[8px] font-bold tracking-[0.3em]">
              OPERATOR // CONSOLE
            </p>
            <p className="mt-1.5 font-[JetBrains_Mono,monospace] text-sm font-bold uppercase tracking-[0.12em] text-[#f8fafc]">
              ADMIN TERMINAL
            </p>
            <p className="mt-1 font-[JetBrains_Mono,monospace] text-[9px] uppercase tracking-[0.16em] hud-accent">
              HOTKEY `~` // CTRL+K →
            </p>
          </button>
        </div>
      </div>
    </>
  );
}
