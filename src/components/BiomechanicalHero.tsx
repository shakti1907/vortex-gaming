"use client";

import { useUltron } from "@/components/UltronContext";

/* ==================================================================
   BiomechanicalHero — obsidian void canvas with volumetric fog,
   scanlines, directional crimson lighting and the biomechanical suit
   focal visual. Headline is chiseled metallic type with dynamic
   crimson glitch cuts that intensify while the Ultron override runs.
   ================================================================== */

function openTerminal(): void {
  window.dispatchEvent(new CustomEvent("vortex:open-terminal"));
}

export function BiomechanicalHero() {
  const { ultron, toggleOverride } = useUltron();

  return (
    <section
      id="ultron-core"
      className="relative flex min-h-screen flex-col overflow-hidden bg-[#020105]"
    >
      {/* ---------- decoration layers (never intercept input) ---------- */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* directional ambient crimson lighting */}
        <div className="absolute -left-40 top-0 h-[46rem] w-[46rem] rounded-full bg-[#ff0033]/12 blur-[130px]" />
        <div className="hud-fog fog-layer absolute inset-0" />
        {/* volumetric dark fog */}
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[#020105] via-[#05020a]/80 to-transparent" />
        {/* scanline overlay */}
        <div className="scanlines absolute inset-0 opacity-70" />
        {/* hard vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(2,1,5,0.85)_100%)]" />
      </div>

      {/* ---------- focal biomechanical suit (right) ---------- */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-full lg:w-[58%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/ultron-suit.jpg"
          alt=""
          className="h-full w-full object-cover object-[65%_center] opacity-[0.88]"
        />
        {/* fade the plate into the void on its left edge */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#020105] via-[#020105]/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#020105] to-transparent" />
        {/* crimson sensor bloom while override is live */}
        <div
          className={`absolute right-[18%] top-[30%] h-40 w-40 rounded-full blur-3xl transition-opacity duration-700 ${
            ultron ? "bg-[#ff0033]/40 opacity-100" : "bg-[#ff0033]/20 opacity-60"
          }`}
        />
      </div>

      {/* ---------- headline block (left) ---------- */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-6 pb-56 pt-32 sm:px-10 lg:pb-64">
        <div className="flex items-center gap-3">
          <span className="led-pulse h-2 w-2 rounded-full hud-accent-bg" />
          <p className="font-[JetBrains_Mono,monospace] text-[11px] font-bold tracking-[0.42em] hud-accent">
            {ultron ? "ULTRON CORE // TAKEOVER ACTIVE" : "ULTRON CORE // SYSTEM NOMINAL"}
          </p>
        </div>

        <h1 className="mt-6 max-w-3xl">
          <span
            data-text="VORTEX GAMING"
            className="metal-text glitch-text block font-[Orbitron,sans-serif] text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl xl:text-8xl"
          >
            VORTEX GAMING
          </span>
          <span
            data-text="SYSTEM OVERRIDE"
            className="metal-text glitch-text mt-2 block font-[Orbitron,sans-serif] text-2xl font-black tracking-[0.18em] text-transparent sm:text-4xl xl:text-5xl"
            style={{
              backgroundImage: ultron
                ? "linear-gradient(180deg,#ffd7de 0%,#ff0033 40%,#7d0019 52%,#ff5c7c 66%,#ffb3c1 100%)"
                : undefined,
            }}
          >
            SYSTEM OVERRIDE
          </span>
        </h1>

        <p className="mt-7 max-w-xl text-base leading-relaxed text-[#a9b2c3] sm:text-lg">
          Biomechanical command nexus for the sixteen-title arcade grid. Sharp telemetry,
          signed score ledgers and a live operator console —{" "}
          <span className="font-semibold text-[#e8ecf5]">
            {ultron ? "the machine is running the show now." : "awaiting your override."}
          </span>
        </p>

        {/* action row */}
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <a
            href="/index.html"
            className="clip-slant hud-glow bg-[#ff0033] px-9 py-4 font-[Orbitron,sans-serif] text-sm font-bold tracking-[0.22em] text-white transition hover:brightness-110"
          >
            ENTER THE ARCADE ↗
          </a>
          <button
            type="button"
            onClick={openTerminal}
            className="clip-slant hud-accent-border border bg-black/40 px-9 py-4 font-[JetBrains_Mono,monospace] text-sm font-bold tracking-[0.22em] hud-accent backdrop-blur-md transition hover:bg-white/5"
          >
            OPEN TERMINAL
          </button>
          <button
            type="button"
            onClick={toggleOverride}
            aria-pressed={ultron}
            className="clip-tag hud-accent-border border px-5 py-2.5 font-[JetBrains_Mono,monospace] text-[11px] font-bold tracking-[0.24em] hud-accent transition hover:bg-white/5"
          >
            {ultron ? "DISENGAGE ULTRON" : "ENGAGE ULTRON"}
          </button>
        </div>

        {/* system readout strip */}
        <div className="mt-12 flex flex-wrap gap-x-10 gap-y-3 font-[JetBrains_Mono,monospace] text-[10px] tracking-[0.22em] text-[#5c6474]">
          <span>CORE&nbsp;//&nbsp;ULTRON-9</span>
          <span>PLATING&nbsp;//&nbsp;OBSIDIAN-ALLOY</span>
          <span className="hud-accent">SIGNAL&nbsp;//&nbsp;{ultron ? "CORRUPTED" : "STABLE"}</span>
          <span>THREAT&nbsp;//&nbsp;{ultron ? "OMEGA" : "LOW"}</span>
        </div>
      </div>

      {/* ---------- bottom HUD dock space guard (tiles live in BiomechanicalHud) ---------- */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-52" />
    </section>
  );
}
