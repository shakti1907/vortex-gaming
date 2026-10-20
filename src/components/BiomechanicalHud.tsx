"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUltron } from "@/components/UltronContext";

/* ==================================================================
   BiomechanicalHud — sticky command header + widescreen side rails:
     · header: metallic VORTEX brand with "GAMING // BIOMECH OS"
       subtitle and a pulsing status indicator, centered tracking nav
       (GAMES · LEADERBOARD · ULTRON CORE · TERMINAL), right-hand
       controls — "● OVERRIDE: OFF/ON" status text plus the angled
       neon-red OVERRIDE SYSTEM ↗ / RESTORE SYSTEM ↗ primary button
     · left rail: vertical FOLLOW US + X / Discord / YouTube icons
     · right rail: 01–04 numeric section slider with scroll-spy
   The bottom telemetry dock now lives in-flow inside the hero
   (TelemetryDock) — the old fixed dock that overlapped page content
   is gone. Decoration is pointer-events-none; only real controls
   re-enable pointer events so gameplay input is never intercepted.
   ================================================================== */

function openTerminal(): void {
  window.dispatchEvent(new CustomEvent("vortex:open-terminal"));
}

/* brand emblem — angular obsidian shard with a crimson core */
function Brandmark({ hot }: { hot: boolean }) {
  return (
    <span className="relative grid h-10 w-10 shrink-0 place-items-center" aria-hidden>
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
      className="pointer-events-auto grid h-9 w-9 place-items-center border border-red-900/40 bg-black/50 text-[#64748b] transition hover:border-[#ff0055]/60 hover:text-[#ff0055] hover:shadow-[0_0_18px_rgba(255,0,85,0.25)]"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d={path} />
      </svg>
    </a>
  );
}

/* ↗ north-east arrow for the angled primary actions */
function ArrowUpRight({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <path d="M7 17 17 7M8.5 7H17v8.5" strokeLinecap="square" />
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

  /* scroll-spy — track which on-page section owns the viewport */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setSlide(entry.target.id === "game-deck" ? 2 : 1);
        }
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    const hero = document.getElementById("ultron-core");
    const deck = document.getElementById("game-deck");
    if (hero) observer.observe(hero);
    if (deck) observer.observe(deck);
    return () => observer.disconnect();
  }, []);

  function railAction(step: number): void {
    if (step === 1) document.getElementById("ultron-core")?.scrollIntoView({ behavior: "smooth" });
    else if (step === 2) document.getElementById("game-deck")?.scrollIntoView({ behavior: "smooth" });
    else if (step === 3) window.location.assign("/index.html#leaderboard");
    else openTerminal();
  }

  return (
    <>
      {/* ================= STICKY COMMAND HEADER ================= */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
        <div className="ultron-frame pointer-events-auto relative mx-auto flex max-w-[110rem] items-center gap-4 px-4 py-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.65)]">
          {/* ---- brand block ---- */}
          <Link href="/" className="group flex items-center gap-3">
            <Brandmark hot={ultron} />
            <div className="leading-none">
              <p className="metal-text font-display text-lg font-black uppercase tracking-[0.24em]">
                VORTEX
              </p>
              <p className="mt-2 flex items-center gap-2">
                {ultron ? <span className="status-dot" /> : <span className="status-dot-cyan" />}
                <span className="ultron-label text-[8px] tracking-[0.34em]">
                  GAMING <span className="hud-accent">{"//"}</span> BIOMECH OS
                </span>
              </p>
            </div>
          </Link>

          {/* ---- centered tracking navigation ---- */}
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-5 font-[JetBrains_Mono,monospace] text-[10px] font-bold uppercase tracking-[0.26em] text-[#94a3b8] lg:flex xl:gap-7 xl:text-[11px]">
            {NAV_LINKS.map((link) => (
              <a key={link.label} href={link.href} className="group relative py-1 transition hover:text-white">
                {link.label}
                <span className="absolute inset-x-0 -bottom-0.5 h-px scale-x-0 bg-[#ff0055] shadow-[0_0_8px_rgba(255,0,85,0.8)] transition-transform duration-300 group-hover:scale-x-100" />
              </a>
            ))}
            <button type="button" onClick={openTerminal} className="group relative py-1 transition hover:text-white">
              TERMINAL
              <span className="absolute inset-x-0 -bottom-0.5 h-px scale-x-0 bg-[#ff0055] shadow-[0_0_8px_rgba(255,0,85,0.8)] transition-transform duration-300 group-hover:scale-x-100" />
            </button>
          </nav>

          {/* ---- right-hand override controls ---- */}
          <div className="ml-auto flex items-center gap-3">
            <span
              aria-live="polite"
              className={`hidden items-center gap-2 font-[JetBrains_Mono,monospace] text-[10px] font-bold uppercase tracking-[0.26em] xl:flex ${
                ultron ? "hud-accent" : "tac-accent"
              }`}
            >
              <span className={ultron ? "status-dot" : "status-dot-cyan"} />
              OVERRIDE: {ultron ? "ON" : "OFF"}
            </span>
            <button
              type="button"
              onClick={toggleOverride}
              aria-pressed={ultron}
              className="btn-ultron-primary px-5 py-2.5 text-[10px] sm:px-6 sm:text-[11px]"
            >
              <span className="hidden sm:inline">{ultron ? "RESTORE SYSTEM" : "OVERRIDE SYSTEM"}</span>
              <span className="sm:hidden">{ultron ? "RESTORE" : "OVERRIDE"}</span>
              <ArrowUpRight />
            </button>

            {/* mobile menu trigger */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Toggle navigation"
              className="grid h-10 w-10 shrink-0 place-items-center border border-red-900/40 bg-black/50 text-[#e2e8f0] transition hover:border-[#ff0055]/60 hover:text-[#ff0055] lg:hidden"
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
                    <ArrowUpRight className="h-3 w-3" />
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
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              </li>
            </ul>
            <p
              className={`mt-2 flex items-center gap-2 border-t border-red-900/30 pt-3 font-[JetBrains_Mono,monospace] text-[9px] uppercase tracking-[0.26em] ${
                ultron ? "hud-accent" : "tac-accent"
              }`}
            >
              <span className={ultron ? "status-dot" : "status-dot-cyan"} />
              OVERRIDE: {ultron ? "ON — TAKEOVER ACTIVE" : "OFF — SYSTEM NOMINAL"}
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

      {/* ================= RIGHT RAIL — 01–04 SECTION SLIDER ================= */}
      <aside
        aria-label="Section navigation"
        className="fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-4 xl:flex"
      >
        {[
          { n: 1, label: "Ultron Core — hero nexus" },
          { n: 2, label: "Game Deck — sixteen titles" },
          { n: 3, label: "Leaderboard — arcade rankings" },
          { n: 4, label: "Terminal — operator console" },
        ].map(({ n, label }) => (
          <button
            key={n}
            type="button"
            onClick={() => railAction(n)}
            aria-label={label}
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
    </>
  );
}
