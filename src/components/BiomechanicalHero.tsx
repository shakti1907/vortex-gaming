"use client";

import { useUltron } from "@/components/UltronContext";
import { TelemetryDock } from "@/components/TelemetryDock";

/* ==================================================================
   BiomechanicalHero — Ultron Core Command Nexus canvas: pitch
   obsidian #050508, subtle dark grid lines, dark red/cyan radial
   atmosphere, scanlines and the biomechanical suit focal plate.
   · top status badge — glowing cyan "● ULTRON CORE // SYSTEM
     NOMINAL", flipping to crimson "TAKEOVER ACTIVE" on override
   · dual-line metallic headline: VORTEX / GAMING stacked
   · "SYSTEM OVERRIDE" glowing crimson sub-heading
   · CTAs: ENTER THE ARCADE ↗ (neon-red slash), OPEN TERMINAL (dark
     tactical outline), ENGAGE/DISENGAGE ULTRON toggle
   · TelemetryDock rides mt-auto at the section foot — in flow, so
     it can never overlap the game grid below.
   ================================================================== */

function openTerminal(): void {
  window.dispatchEvent(new CustomEvent("vortex:open-terminal"));
}

/* ↗ north-east arrow for the primary action */
function ArrowUpRight() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <path d="M7 17 17 7M8.5 7H17v8.5" strokeLinecap="square" />
    </svg>
  );
}

/* ⏻ power glyph for the Ultron engagement toggle */
function PowerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M12 3v9" strokeLinecap="square" />
      <path d="M6.8 6.8a7.5 7.5 0 1 0 10.4 0" />
    </svg>
  );
}

export function BiomechanicalHero() {
  const { ultron, toggleOverride } = useUltron();

  return (
    <section
      id="ultron-core"
      className="relative flex min-h-screen flex-col overflow-hidden bg-[#050508]"
    >
      {/* ---------- decoration layers (never intercept input) ---------- */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="tactical-grid absolute inset-0" />
        <div className="radial-obsidian absolute inset-0" />
        <div className="absolute -left-40 top-0 h-[46rem] w-[46rem] rounded-full bg-[#ff0055]/10 blur-[130px]" />
        <div className="absolute -right-36 -top-44 h-[36rem] w-[36rem] rounded-full bg-[#22e0ff]/[0.06] blur-[140px]" />
        <div className="hud-fog fog-layer absolute inset-0" />
        <div className="scanlines absolute inset-0" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.85)_100%)]" />
      </div>

      {/* ---------- focal biomechanical suit (right) ---------- */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-full lg:w-[58%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/ultron-suit.jpg"
          alt=""
          className="h-full w-full object-cover object-[65%_center] opacity-[0.85]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050508] via-[#050508]/60 to-transparent" />
        <div className="absolute inset-0 bg-[#ff0055]/[0.07] mix-blend-overlay" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#030305] to-transparent" />
        <div
          className={`absolute right-[18%] top-[30%] h-40 w-40 rounded-full blur-3xl transition-opacity duration-700 ${
            ultron ? "bg-[#ff0055]/55 opacity-100" : "bg-[#dc2626]/25 opacity-70"
          }`}
        />
      </div>

      {/* ---------- headline block ---------- */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-6 pb-12 pt-32 sm:px-10 sm:pt-36">
        {/* top status badge */}
        <div className="flex items-center gap-3">
          {ultron ? <span className="status-dot" /> : <span className="status-dot-cyan" />}
          <p
            className={`font-[JetBrains_Mono,monospace] text-[10px] font-bold uppercase tracking-[0.4em] sm:text-[11px] ${
              ultron
                ? "hud-accent drop-shadow-[0_0_10px_rgba(255,0,85,0.55)]"
                : "tac-accent drop-shadow-[0_0_10px_rgba(34,224,255,0.45)]"
            }`}
          >
            {"ULTRON CORE // "}
            {ultron ? "TAKEOVER ACTIVE" : "SYSTEM NOMINAL"}
          </p>
          <span
            aria-hidden
            className={`hidden h-px w-24 sm:block ${
              ultron
                ? "bg-gradient-to-r from-[#ff0055]/70 to-transparent"
                : "bg-gradient-to-r from-[#22e0ff]/60 to-transparent"
            }`}
          />
        </div>

        {/* dual-line metallic headline + crimson sub-heading */}
        <h1 className="mt-7">
          <span
            data-text="VORTEX"
            className="metal-text glitch-text font-display block text-6xl font-black uppercase leading-[0.95] tracking-[0.02em] sm:text-8xl xl:text-9xl"
          >
            VORTEX
          </span>
          <span
            data-text="GAMING"
            className="metal-text glitch-text font-display block text-6xl font-black uppercase leading-[0.95] tracking-[0.02em] sm:text-8xl xl:text-9xl"
          >
            GAMING
          </span>
          <span
            data-text="SYSTEM OVERRIDE"
            className="crimson-glow-text glitch-text font-display mt-3 block text-3xl font-black uppercase leading-[1.05] tracking-[0.16em] sm:mt-4 sm:text-5xl xl:text-6xl"
          >
            SYSTEM OVERRIDE
          </span>
        </h1>

        <p className="mt-7 max-w-xl text-base leading-relaxed text-[#64748b] sm:text-lg">
          Biomechanical command nexus for the sixteen-title arcade grid. Sharp telemetry, signed
          score ledgers and a live operator console — awaiting your override.
        </p>

        {/* action row */}
        <div className="mt-9 flex flex-wrap items-center gap-4">
          {/* /index.html is the static arcade shell in /public — not an App Router page */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/index.html" className="btn-ultron-primary px-9 py-4 text-sm">
            ENTER THE ARCADE
            <ArrowUpRight />
          </a>
          <button type="button" onClick={openTerminal} className="btn-ultron-secondary px-9 py-4 text-sm">
            OPEN TERMINAL
          </button>
          <button
            type="button"
            onClick={toggleOverride}
            aria-pressed={ultron}
            className={`btn-ultron-secondary px-6 py-3 text-[11px] ${
              ultron ? "shadow-[0_0_26px_rgba(255,0,85,0.4)]" : ""
            }`}
          >
            <PowerIcon />
            {ultron ? "DISENGAGE ULTRON" : "ENGAGE ULTRON"}
          </button>
        </div>
      </div>

      {/* ---------- in-flow bottom telemetry HUD (no more overlap) ---------- */}
      <TelemetryDock />
    </section>
  );
}
