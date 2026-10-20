"use client";

import { useUltron } from "@/components/UltronContext";

/* ==================================================================
   BiomechanicalHero — obsidian deep-alloy canvas with a 32px cyan
   grid, volumetric fog, scanlines and directional crimson lighting.
   Headline: "GAMING SYSTEM OVERRIDE" in dual-tone gradient type;
   CTAs run the arcade and the operator terminal; a bottom telemetry
   status strip reports core state in // tactical notation.
   ================================================================== */

function openTerminal(): void {
  window.dispatchEvent(new CustomEvent("vortex:open-terminal"));
}

export function BiomechanicalHero() {
  const { ultron, toggleOverride } = useUltron();

  return (
    <section
      id="ultron-core"
      className="relative flex min-h-screen flex-col overflow-hidden bg-[#05070a]"
    >
      {/* ---------- decoration layers (never intercept input) ---------- */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="ultron-grid absolute inset-0" />
        <div className="ultron-radial absolute inset-0" />
        <div className="absolute -left-40 top-0 h-[46rem] w-[46rem] rounded-full bg-[#ff0055]/10 blur-[130px]" />
        <div className="hud-fog fog-layer absolute inset-0" />
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[#05070a] via-[#05070a]/80 to-transparent" />
        <div className="scanlines absolute inset-0 opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(5,7,10,0.85)_100%)]" />
      </div>

      {/* ---------- focal biomechanical suit (right) ---------- */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-full lg:w-[58%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/ultron-suit.jpg"
          alt=""
          className="h-full w-full object-cover object-[65%_center] opacity-[0.88]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05070a] via-[#05070a]/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#05070a] to-transparent" />
        <div
          className={`absolute right-[18%] top-[30%] h-40 w-40 rounded-full blur-3xl transition-opacity duration-700 ${
            ultron ? "bg-[#ff0055]/45 opacity-100" : "bg-[#00f3ff]/20 opacity-70"
          }`}
        />
      </div>

      {/* ---------- headline block (left) ---------- */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-6 pb-56 pt-32 sm:px-10 lg:pb-64">
        <div className="flex items-center gap-3">
          <span className="status-dot" />
          <p className="ultron-label text-[11px] font-bold tracking-[0.42em] hud-accent">
            {ultron ? "STATUS // TAKEOVER ACTIVE" : "STATUS // SYSTEM ONLINE"}
          </p>
        </div>

        <h1 className="mt-6 max-w-3xl">
          <span
            data-text="GAMING SYSTEM"
            className="metal-text glitch-text block font-[JetBrains_Mono,monospace] text-4xl font-black uppercase leading-[0.98] tracking-tight sm:text-6xl xl:text-7xl"
          >
            GAMING SYSTEM
          </span>
          <span
            data-text="OVERRIDE"
            className="dual-tone-text glitch-text mt-2 block font-[JetBrains_Mono,monospace] text-5xl font-black uppercase leading-[0.98] tracking-[0.06em] sm:text-7xl xl:text-8xl"
          >
            OVERRIDE
          </span>
        </h1>

        <p className="mt-7 max-w-xl text-base leading-relaxed text-[#64748b] sm:text-lg">
          <span className="font-semibold text-[#f8fafc]">TACTICAL OVERVIEW //</span> sixteen
          playable titles routed through the biomechanical command core — signed score ledgers,
          live telemetry frames and a root operator console.{" "}
          <span className="font-semibold text-[#f8fafc]">
            {ultron ? "ULTRON HAS THE CONTROLS." : "AWAITING YOUR OVERRIDE."}
          </span>
        </p>

        {/* action row */}
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <a href="/index.html" className="btn-ultron-primary px-9 py-4 text-sm">
            ENTER THE ARCADE
          </a>
          <button type="button" onClick={openTerminal} className="btn-ultron-secondary px-9 py-4 text-sm">
            OPEN TERMINAL
          </button>
          <button
            type="button"
            onClick={toggleOverride}
            aria-pressed={ultron}
            className="clip-tag hud-accent-border border px-5 py-2.5 font-[JetBrains_Mono,monospace] text-[11px] font-bold uppercase tracking-[0.24em] hud-accent transition hover:bg-white/5"
          >
            {ultron ? "DISENGAGE ULTRON" : "ENGAGE ULTRON"}
          </button>
        </div>

        {/* bottom telemetry status strip */}
        <div className="ultron-frame mt-12 flex flex-wrap items-center gap-x-10 gap-y-3 px-5 py-3.5 font-[JetBrains_Mono,monospace] text-[10px] uppercase tracking-[0.26em] text-[#64748b]">
          <span className="flex items-center gap-2">
            <span className="status-dot" />
            CORE // ULTRON-9
          </span>
          <span>STATUS // {ultron ? "CORRUPTED" : "STABLE"}</span>
          <span>PLATING // OBSIDIAN-ALLOY</span>
          <span className={ultron ? "text-[#ff0055]" : "text-[#00f3ff]"}>
            SIGNAL // {ultron ? "OMEGA" : "NOMINAL"}
          </span>
        </div>
      </div>

      {/* ---------- bottom HUD dock space guard (tiles live in BiomechanicalHud) ---------- */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-52" />
    </section>
  );
}
