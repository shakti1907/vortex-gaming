"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUltron } from "@/components/UltronContext";

/* ==================================================================
   BiomechanicalHud — sticky command header, side rails and the
   bottom telemetry dock around the hero canvas:
     · sticky glass nav — "VORTEX" brand + "GAMING // BIOMECH OS"
       subtitle + glowing red status dot (SYSTEM ONLINE / TAKEOVER
       ACTIVE), links (GAMES · LEADERBOARD · ULTRON CORE · TERMINAL),
       live OVERRIDE SYSTEM button with an OVERRIDE: ON/OFF badge
     · left rail: vertical FOLLOW US + status icons (widescreen)
     · right rail: numeric slide indicators 01–04 (widescreen)
     · bottom dock: four .ultron-frame telemetry tiles — featured
       title, mission parameters, live global score index, operator
       console quick links with hotkeys
   Decoration frames are pointer-events-none; only real controls
   re-enable pointer events so gameplay input is never intercepted.
   ================================================================== */

function openTerminal(): void {
  window.dispatchEvent(new CustomEvent("vortex:open-terminal"));
}

/* brand emblem — angular obsidian shard with a crimson core */
function Brandmark({ hot }: { hot: boolean }) {
  return (
    <span className="relative grid h-10 w-10 place-items-center" aria-hidden>
      <svg viewBox="0 0 40 40" className="h-10 w-10">
        <polygon
          points="20,2 37,11 37,29 20,38 3,29 3,11"
          fill="#050508"
          stroke="var(--hud-accent-line)"
          strokeWidth="2"
        />
        <polygon points="20,10 29,15 29,25 20,30 11,25 11,15" fill="none" stroke="#dc2626" strokeWidth="1.6" />
        <circle cx="20" cy="20" r="3.4" fill="var(--hud-accent)" />
      </svg>
      <span
        className={`absolute inset-0 rounded-full blur-md transition-opacity duration-700 ${
          hot ? "bg-[#ff0055]/45 opacity-100" : "bg-[#ff0055]/20 opacity-60"
        }`}
      />
    </span>
  );
}

function SocialIcon({ label, href, path }: { label: string; href: string; path: string }) {
  return (
    <a
      href={href}
      aria-label={label}
      target="_blank"
      rel="noreferrer"
      className="pointer-events-auto grid h-9 w-9 place-items-center border border-red-900/40 bg-black/50 text-[#64748b] transition hover:border-[color:var(--hud-accent-line)] hover:text-[#ff0055] hover:shadow-[0_0_18px_rgba(255,0,85,0.25)]"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d={path} />
      </svg>
    </a>
  );
}

/* right-pointing chevron used by nav + primary actions */
function ArrowIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <path d="M4 12h15M13 6l6 6-6 6" strokeLinecap="square" />
    </svg>
  );
}

const NAV_LINKS = [
  { label: "GAMES", href: "#game-deck" },
  { label: "LEADERBOARD", href: "/index.html#leaderboard" },
  { label: "ULTRON CORE", href: "#ultron-core" },
] as const;

export function BiomechanicalHud() {
  const { ultron, toggleOverride } = useUltron();
  const [menuOpen, setMenuOpen] = useState(false);
  const [slide, setSlide] = useState(1);
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

  return (
    <>
      {/* ================= STICKY COMMAND HEADER ================= */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
        <div className="ultron-frame pointer-events-auto mx-auto flex max-w-[110rem] items-center gap-4 px-4 py-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.65)]">
          {/* ---- brand block ---- */}
          <Link href="/" className="group flex items-center gap-3">
            <Brandmark hot={ultron} />
            <div className="leading-none">
              <p className="font-display text-lg font-black uppercase tracking-[0.24em] text-white transition group-hover:text-[#ff5c8a]">
                VORTEX
              </p>
              <p className="ultron-label mt-1.5 text-[8px] tracking-[0.34em]">
                GAMING <span className="hud-accent">{"//"}</span> BIOMECH OS
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 font-[JetBrains_Mono,monospace] text-[8px] font-bold uppercase tracking-[0.28em] hud-accent">
                <span className="status-dot" />
                {ultron ? "TAKEOVER ACTIVE" : "SYSTEM ONLINE"}
              </p>
            </div>
          </Link>

          {/* ---- desktop navigation ---- */}
          <nav className="ml-auto hidden items-center gap-7 font-[JetBrains_Mono,monospace] text-[11px] font-bold uppercase tracking-[0.26em] text-[#94a3b8] lg:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="relative py-1 transition hover:text-white"
              >
                {link.label}
                <span className="absolute inset-x-0 -bottom-0.5 h-px scale-x-0 bg-[#ff0055] shadow-[0_0_8px_rgba(255,0,85,0.8)] transition-transform duration-300 hover:scale-x-100" />
              </a>
            ))}
            <button
              type="button"
              onClick={openTerminal}
              className="relative py-1 text-left transition hover:text-white"
            >
              TERMINAL
              <span className="absolute inset-x-0 -bottom-0.5 h-px scale-x-0 bg-[#ff0055] shadow-[0_0_8px_rgba(255,0,85,0.8)] transition-transform duration-300 hover:scale-x-100" />
            </button>
          </nav>

          {/* ---- override controls ---- */}
          <div className="ml-auto flex items-center gap-3 lg:ml-6">
            <span
              aria-live="polite"
              className={`clip-tag hidden border px-3 py-1.5 font-[JetBrains_Mono,monospace] text-[9px] font-bold uppercase tracking-[0.22em] sm:block ${
                ultron
                  ? "border-[#ff0055]/70 bg-[#ff0055]/15 text-[#ff5c8a] shadow-[0_0_16px_rgba(255,0,85,0.4)]"
                  : "border-red-900/60 bg-red-950/30 text-[#dc2626]"
              }`}
            >
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full hud-accent-bg led-pulse align-middle" />
              OVERRIDE: {ultron ? "ON" : "OFF"}
            </span>
            <button
              type="button"
              onClick={toggleOverride}
              aria-pressed={ultron}
              className={`btn-ultron-primary px-5 py-2.5 text-[10px] sm:px-6 sm:text-[11px] ${
                ultron ? "brightness-110" : ""
              }`}
            >
              <span className="hidden sm:inline">OVERRIDE SYSTEM</span>
              <span className="sm:hidden">OVERRIDE</span>
              <ArrowIcon />
            </button>

            {/* mobile menu trigger */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Toggle navigation"
              className="grid h-10 w-10 place-items-center border border-red-900/40 bg-black/50 text-[#e2e8f0] transition hover:border-[#ff0055]/60 hover:text-[#ff0055] lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                {menuOpen ? (
                  <path d="M5 5l14 14M19 5L5 19" strokeLinecap="square" />
                ) : (
                  <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="square" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* ---- mobile navigation panel ---- */}
        {menuOpen ? (
          <nav className="ultron-frame pointer-events-auto mx-auto mt-2 max-w-[110rem] px-4 py-3 lg:hidden">
            <ul className="flex flex-col divide-y divide-red-900/30">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between py-3 font-[JetBrains_Mono,monospace] text-xs font-bold uppercase tracking-[0.3em] text-[#94a3b8] transition hover:text-[#ff0055]"
                  >
                    {link.label}
                    <ArrowIcon className="h-3 w-3" />
                  </a>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    openTerminal();
                  }}
                  className="flex w-full items-center justify-between py-3 font-[JetBrains_Mono,monospace] text-xs font-bold uppercase tracking-[0.3em] text-[#94a3b8] transition hover:text-[#ff0055]"
                >
                  TERMINAL
                  <ArrowIcon className="h-3 w-3" />
                </button>
              </li>
            </ul>
            <p className="mt-2 flex items-center gap-2 border-t border-red-900/30 pt-3 font-[JetBrains_Mono,monospace] text-[9px] uppercase tracking-[0.26em] hud-accent">
              <span className="status-dot" />
              OVERRIDE: {ultron ? "ON — TAKEOVER ACTIVE" : "OFF — SYSTEM ONLINE"}
            </p>
          </nav>
        ) : null}
      </header>

      {/* ================= LEFT RAIL — FOLLOW US ================= */}
      <aside
        aria-label="Social links"
        className="fixed left-3 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-5 xl:flex"
      >
        <span className="vertical-rl ultron-label text-[10px] font-bold tracking-[0.5em]">
          FOLLOW US
        </span>
        <span className="h-10 w-px bg-red-900/50" />
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
        aria-label="Section indicators"
        className="fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-4 xl:flex"
      >
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setSlide(n)}
            aria-label={`Section ${n}`}
            aria-current={slide === n}
            className={`pointer-events-auto font-[JetBrains_Mono,monospace] text-[11px] tracking-[0.2em] transition ${
              slide === n ? "hud-accent scale-110" : "text-[#3f3f46] hover:text-[#a1a1aa]"
            }`}
          >
            {String(n).padStart(2, "0")}
            <span
              className={`mx-auto mt-1 block h-px transition-all ${
                slide === n ? "w-5 hud-accent-bg" : "w-2 bg-red-900/60"
              }`}
            />
          </button>
        ))}
      </aside>

      {/* ================= BOTTOM HUD TELEMETRY DOCK ================= */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-3">
        <div className="mx-auto grid max-w-[110rem] grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {/* tile 1 — featured title */}
          {/* /index.html is the static arcade shell in /public — not an App Router page */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/index.html"
            className="ultron-frame pointer-events-auto group px-4 py-3 transition hover:bg-black/85 hover:shadow-[0_0_28px_rgba(255,0,85,0.2)]"
          >
            <p className="ultron-label text-[8px] font-bold tracking-[0.3em]">
              FEATURED TITLE <span className="hud-accent">{"//"}</span> 01
            </p>
            <p className="mt-1.5 font-display text-sm font-bold uppercase tracking-[0.14em] text-white transition group-hover:text-[#ff5c8a]">
              NEON SNAKE
            </p>
            <p className="mt-1.5 flex items-center gap-2 font-[JetBrains_Mono,monospace] text-[9px] font-bold uppercase tracking-[0.18em] hud-accent">
              <span className="status-dot" />
              ACTION / ARCADE — GRID LIVE
            </p>
          </a>

          {/* tile 2 — mission parameters */}
          <div className="ultron-frame px-4 py-3">
            <p className="ultron-label text-[8px] font-bold tracking-[0.3em]">
              MISSION <span className="hud-accent">{"//"}</span> PARAMETERS
            </p>
            <p className="mt-1.5 font-display text-sm font-bold uppercase tracking-[0.1em] text-white">
              {ultron ? "REPEL THE ULTRON TAKEOVER" : "SEIZE THE ULTRON CORE"}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-[JetBrains_Mono,monospace] text-[9px] uppercase tracking-[0.16em] text-[#64748b]">
              <span className="border border-red-900/60 bg-red-950/40 px-1.5 py-0.5 font-bold text-[#dc2626]">
                PRIORITY: OMEGA
              </span>
              <span className="border border-red-900/60 bg-red-950/40 px-1.5 py-0.5 font-bold hud-accent">
                REWARD: XP ×2
              </span>
            </p>
          </div>

          {/* tile 3 — live global score index */}
          <div className="ultron-frame px-4 py-3">
            <p className="ultron-label flex items-center gap-2 text-[8px] font-bold tracking-[0.3em]">
              <span className="status-dot" />
              LIVE GLOBAL SCORE INDEX
            </p>
            <p
              key={tick}
              className={`mt-1 font-[JetBrains_Mono,monospace] text-lg font-bold tracking-[0.12em] text-white ${
                counter ? "score-tick" : ""
              }`}
            >
              {counter ? counter.index.toLocaleString("en-IN") : "—"}
            </p>
            <p className="mt-0.5 font-[JetBrains_Mono,monospace] text-[9px] uppercase tracking-[0.16em] text-[#64748b]">
              {counter
                ? `${counter.pilots > 0 ? counter.pilots + " PILOTS // " : ""}${counter.titles} TITLES // STATUS // ${
                    ultron ? "CORRUPTED" : "STABLE"
                  }`
                : "AWAITING TELEMETRY LINK…"}
            </p>
          </div>

          {/* tile 4 — operator console */}
          <button
            type="button"
            onClick={openTerminal}
            className="ultron-frame pointer-events-auto group px-4 py-3 text-left transition hover:bg-black/85 hover:shadow-[0_0_28px_rgba(255,0,85,0.2)]"
          >
            <p className="ultron-label text-[8px] font-bold tracking-[0.3em]">
              OPERATOR <span className="hud-accent">{"//"}</span> CONSOLE
            </p>
            <p className="mt-1.5 font-display text-sm font-bold uppercase tracking-[0.14em] text-white transition group-hover:text-[#ff5c8a]">
              ADMIN TERMINAL
            </p>
            <p className="mt-1.5 flex items-center gap-2 font-[JetBrains_Mono,monospace] text-[9px] font-bold uppercase tracking-[0.18em] hud-accent">
              HOTKEY <kbd className="border border-red-900/60 bg-black/60 px-1 text-[8px] text-[#e2e8f0]">~</kbd>
              <kbd className="border border-red-900/60 bg-black/60 px-1 text-[8px] text-[#e2e8f0]">CTRL+K</kbd>
              <ArrowIcon className="h-3 w-3 transition-transform group-hover:translate-x-1" />
            </p>
          </button>
        </div>
      </div>
    </>
  );
}
