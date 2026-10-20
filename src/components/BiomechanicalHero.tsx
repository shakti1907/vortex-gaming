"use client";

import { useUltron } from "@/components/UltronContext";

/* ==================================================================
   BiomechanicalHero — obsidian command nexus canvas: deep #050508
   black, dark radial washes, a faint 32px tactical grid, volumetric
   crimson fog, scanlines and the biomechanical suit focal plate.
   Headline: "VORTEX GAMING" in chiseled metallic white/silver over
   a glowing neon-crimson "SYSTEM OVERRIDE" sub-heading. CTAs launch
   the arcade, open the operator terminal and engage the Ultron
   override; a telemetry status strip reports core state below.
   ================================================================== */

function openTerminal(): void {
  window.dispatchEvent(new CustomEvent("vortex:open-terminal"));
}

/* right-pointing arrow for the primary action */
function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <path d="M4 12h15M13 6l6 6-6 6" strokeLinecap="square" />
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
        <div className="hud-fog fog-layer absolute inset-0" />
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[#050508] via-[#050508]/80 to-transparent" />
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
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#050508] to-transparent" />
        <div
          className={`absolute right-[18%] top-[30%] h-40 w-40 rounded-full blur-3xl transition-opacity duration-700 ${
            ultron ? "bg-[#ff0055]/55 opacity-100" : "bg-[#dc2626]/25 opacity-70"
          }`}
        />
      </div>

      {/* ---------- headline block (left) ---------- */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-6 pb-56 pt-36 sm:px-10 lg:pb-64">
        <div className="flex items-center gap-3">
          <span className="status-dot" />
          <p className="ultron-label text-[11px] font-bold tracking-[0.42em] hud-accent">
            {ultron ? "STATUS // TAKEOVER ACTIVE" : "STATUS // SYSTEM ONLINE"}
          </p>
          <span aria-hidden className="hidden h-px w-24 bg-gradient-to-r from-red-900/70 to-transparent sm:block" />
        </div>

        <h1 className="mt-6 max-w-4xl">
          <span
            data-text="VORTEX GAMING"
            className="metal-text glitch-text font-display block text-5xl font-black uppercase leading-[1.02] tracking-[0.04em] sm:text-7xl xl:text-8xl"
          >
            VORTEX GAMING
          </span>
          <span
            data-text="SYSTEM OVERRIDE"
            className="crimson-glow-text glitch-text font-display mt-3 block text-3xl font-black uppercase leading-[1.05] tracking-[0.14em] sm:mt-4 sm:text-5xl xl:text-6xl"
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
            <ArrowIcon />
          </a>
          <button type="button" onClick={openTerminal} className="btn-ultron-secondary px-9 py-4 text-sm">
            OPEN TERMINAL
          </button>
          <button
            type="button"
            onClick={toggleOverride}
            aria-pressed={ultron}
            className={`clip-tag border px-5 py-2.5 font-[JetBrains_Mono,monospace] text-[11px] font-bold uppercase tracking-[0.24em] transition hover:bg-white/5 ${
              ultron
                ? "border-[#ff0055]/70 text-[#ff5c8a] shadow-[0_0_22px_rgba(255,0,85,0.35)]"
                : "hud-accent-border hud-accent"
            }`}
          >
            {ultron ? "⏻ DISENGAGE ULTRON" : "⏻ ENGAGE ULTRON"}
          </button>
        </div>

        {/* telemetry status strip */}
        <div className="ultron-frame mt-12 flex flex-wrap items-center gap-x-10 gap-y-3 px-5 py-3.5 font-[JetBrains_Mono,monospace] text-[10px] uppercase tracking-[0.26em] text-[#64748b]">
          <span className="flex items-center gap-2">
            <span className="status-dot" />
            CORE // ULTRON-9
          </span>
          <span>
            STATUS // <span className={ultron ? "text-[#ff5c8a]" : "text-[#e2e8f0]"}>{ultron ? "CORRUPTED" : "STABLE"}</span>
          </span>
          <span>PLATING // OBSIDIAN-ALLOY</span>
          <span className={ultron ? "text-[#ff0055]" : "hud-accent"}>
            SIGNAL // {ultron ? "OMEGA" : "NOMINAL"}
          </span>
        </div>
      </div>

      {/* ---------- bottom HUD dock space guard (tiles live in BiomechanicalHud) ---------- */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-52" />
    </section>
  );
}
