"use client";

import { useMemo, useState, type ReactNode } from "react";

/* ==================================================================
   BiomechanicalGameGrid — the sixteen arcade titles as obsidian
   biomechanical panels (bg-[#07070d], razor red-900/40 borders that
   ignite to red-500 on hover):
     · per-title neon glyph badges drawn to match each game and its
       genre (glowing snake, sentinel invader, drift vectors, synth
       sun, laser reflect rig, …) — titles/keys stay 1:1 accurate
     · cyberpunk filter tabs (#ALL #ARCADE #RACING #PUZZLE #RETRO)
     · high-tech search across title, tagline and engine key
   Presentation-only client state (filter + query hooks). Every PLAY
   trigger routes into the untouched arcade shell at /index.html —
   no game logic, canvas handlers, API routes or server actions are
   referenced or modified here.
   ================================================================== */

type Category = "arcade" | "racing" | "puzzle" | "retro";

type GameEntry = {
  key: string;
  title: string;
  tagline: string;
  status: "LIVE" | "HOT" | "NEW";
};

type CategoryBlock = {
  index: string;
  name: string;
  category: Category;
  games: GameEntry[];
};

const CATEGORY_BLOCKS: CategoryBlock[] = [
  {
    index: "01",
    name: "ACTION / ARCADE",
    category: "arcade",
    games: [
      { key: "neon-snake", title: "Neon Snake", tagline: "Dash boosts, plasma trails, multi-stage cores.", status: "HOT" },
      { key: "cyber-invaders", title: "Cyber Invaders", tagline: "Destructible shields and a sentinel boss core.", status: "LIVE" },
      { key: "asteroid-vector", title: "Asteroid Vector", tagline: "360° inertia drift around a hungry singularity.", status: "LIVE" },
      { key: "bullet-hell-rush", title: "Bullet Hell Rush", tagline: "Procedural bullet storms — bend time to survive.", status: "NEW" },
    ],
  },
  {
    index: "02",
    name: "PUZZLE / STRATEGY",
    category: "puzzle",
    games: [
      { key: "grid-stacker", title: "Cyber Grid Stacker", tagline: "Chain line clears before the gravity surge.", status: "LIVE" },
      { key: "quantum-laser", title: "Quantum Laser Reflect", tagline: "Rotate mirrors, bend the beam, light every node.", status: "HOT" },
      { key: "memory-matrix", title: "Memory Matrix", tagline: "Rhythmic sequence hacking through the glitch.", status: "LIVE" },
      { key: "neon-flow", title: "Neon Flow", tagline: "Route the power nodes — wires may never cross.", status: "LIVE" },
    ],
  },
  {
    index: "03",
    name: "RETRO / CLASSIC",
    category: "retro",
    games: [
      { key: "neon-pong", title: "Neon Pong 2.0", tagline: "Curve shots, paddle powerups, reactive walls.", status: "LIVE" },
      { key: "grid-pac-runner", title: "Grid Pac-Runner", tagline: "Harvest data nodes, outwit the patrol sentinels.", status: "LIVE" },
      { key: "cyber-soar", title: "Cyber Soar", tagline: "Precision thruster flight through energy pillars.", status: "NEW" },
      { key: "retro-defender", title: "Retro Defender", tagline: "Intercept the warheads, save all six cities.", status: "HOT" },
    ],
  },
  {
    index: "04",
    name: "RACING / SPEED",
    category: "racing",
    games: [
      { key: "outrun-drive", title: "Outrun 2D Drive", tagline: "Pseudo-3D synthwave highway with nitro burn.", status: "LIVE" },
      { key: "cyber-drift", title: "Cyber Drift", tagline: "Break traction and bank the drift multiplier.", status: "LIVE" },
      { key: "hyper-speed-dodge", title: "Hyper Speed Dodge", tagline: "First-person wireframe tunnel at terminal velocity.", status: "HOT" },
      { key: "grid-dash", title: "Grid Dash", tagline: "Beat-locked jumps and slides over laser hazards.", status: "NEW" },
    ],
  },
];

/* ---------- per-title neon glyph badges (24×24 stroke art) ---------- */
const GLYPHS: Record<string, ReactNode> = {
  /* glowing snake — plasma trail, angular head, data morsel */
  "neon-snake": (
    <>
      <path d="M3 20h6a3 3 0 0 0 3-3v-5a3 3 0 0 1 3-3h3" />
      <path d="M18 6.5h3.5V10H18z" />
      <circle cx="5.5" cy="14.5" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  /* sentinel invader — dome body, antenna, spread legs */
  "cyber-invaders": (
    <>
      <path d="M6.5 11h11v4.5h-11z" />
      <path d="M9 11a3 3 0 0 1 6 0" />
      <path d="M9.5 8 8 5.5M14.5 8 16 5.5" />
      <path d="M8.5 15.5V18M12 15.5v3.5M15.5 15.5V18" />
      <path d="M9.6 13h1.2M13.2 13h1.2" strokeWidth="2.2" />
    </>
  ),
  /* asteroid vector — faceted rock on a thrust trajectory */
  "asteroid-vector": (
    <>
      <path d="M11 6.5l4.5 1.8 2 5-2 4.5-5 1.7-4.5-2-1.8-5 2-4.3z" />
      <circle cx="10.5" cy="12" r="1.4" />
      <path d="M20.5 3.5 16.8 7.2M20.5 3.5h-3.2M20.5 3.5v3.2" />
    </>
  ),
  /* bullet hell — radial storm burst around the core */
  "bullet-hell-rush": (
    <>
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 3.5v3.2M12 17.3v3.2M3.5 12h3.2M17.3 12h3.2M6 6l2.2 2.2M15.8 15.8 18 18M18 6l-2.2 2.2M8.2 15.8 6 18" />
      <circle cx="12" cy="2.4" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="21.6" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  /* grid stacker — falling tetromino stack */
  "grid-stacker": (
    <>
      <rect x="4" y="14.5" width="5" height="5" />
      <rect x="9.5" y="14.5" width="5" height="5" />
      <rect x="9.5" y="9" width="5" height="5" />
      <rect x="15" y="14.5" width="5" height="5" />
      <path d="M12 3v3.5M10.6 5.1 12 6.5l1.4-1.4" />
    </>
  ),
  /* quantum laser — emitter, 45° mirror, lit target node */
  "quantum-laser": (
    <>
      <circle cx="4" cy="19" r="1.6" />
      <path d="M5.2 17.8 10.6 12.4" />
      <path d="M9.2 9.2l3.6 3.6" />
      <path d="M11.4 12h7.2" />
      <circle cx="20.2" cy="12" r="1.6" />
    </>
  ),
  /* memory matrix — sequence grid, one cell lit */
  "memory-matrix": (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" fill="currentColor" fillOpacity="0.4" />
    </>
  ),
  /* neon flow — node-to-node circuit routing */
  "neon-flow": (
    <>
      <circle cx="5" cy="6" r="1.8" />
      <circle cx="19" cy="18" r="1.8" />
      <path d="M5 7.8V15a2 2 0 0 0 2 2h10.2" />
      <path d="M6.8 6H16a2 2 0 0 1 2 2v8.2" />
    </>
  ),
  /* neon pong — paddles, dashed net, live ball */
  "neon-pong": (
    <>
      <path d="M4 7.5v9M20 7.5v9" strokeWidth="2.2" />
      <path d="M12 3v18" strokeDasharray="2 3" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  /* grid pac-runner — harvest wedge chasing data nodes */
  "grid-pac-runner": (
    <>
      <path d="M18 8.5a7 7 0 1 0 0 7L12 12z" />
      <circle cx="17.8" cy="8.8" r="1" fill="currentColor" stroke="none" />
      <circle cx="20.8" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  /* cyber soar — thruster diamond between energy pillars */
  "cyber-soar": (
    <>
      <path d="M5 3v5.5M5 15.5V21M3 8.5h4M3 15.5h4" />
      <path d="M19 3v3.5M19 17.5V21M17 6.5h4M17 17.5h4" />
      <path d="M9 12l3-2.2 3 2.2-3 2.2z" fill="currentColor" fillOpacity="0.5" />
    </>
  ),
  /* retro defender — skyline under an incoming warhead */
  "retro-defender": (
    <>
      <path d="M3 20.5h18" />
      <path d="M5 20.5V16h3v4.5M10.5 20.5v-7h3v7M16 20.5V17h3v3.5" />
      <path d="M17.6 5.4 14.4 10" />
      <circle cx="18.4" cy="4.2" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  /* outrun drive — synth sun over a perspective highway */
  "outrun-drive": (
    <>
      <circle cx="12" cy="8.5" r="4.5" />
      <path d="M8.2 10h7.6M9.2 12h5.6" />
      <path d="M12 15.5 8.5 21M12 15.5 15.5 21M12 15.5V21" />
    </>
  ),
  /* cyber drift — chassis mid-slide with speed chevrons */
  "cyber-drift": (
    <>
      <rect x="3.5" y="12.5" width="10" height="4.5" rx="1" />
      <path d="M5.5 12.5l1.8-3h3.4l1.8 3" />
      <circle cx="6.2" cy="18.2" r="1.2" />
      <circle cx="10.8" cy="18.2" r="1.2" />
      <path d="M16 8.5l3 3.5-3 3.5M19.5 6l3.5 6-3.5 6" opacity="0.6" />
    </>
  ),
  /* hyper speed dodge — wireframe tunnel at terminal velocity */
  "hyper-speed-dodge": (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" />
      <rect x="8.5" y="8.5" width="7" height="7" />
      <path d="M1.5 1.5 3.5 3.5M22.5 1.5 20.5 3.5M1.5 22.5 3.5 20.5M22.5 22.5 20.5 20.5" />
    </>
  ),
  /* grid dash — volt runner over a laser hazard line */
  "grid-dash": (
    <>
      <path d="M13 2.5 7 12.5h4l-1 8.5 7-11h-4z" />
      <path d="M3 21.5h18" />
    </>
  ),
};

function GameGlyph({ gameKey }: { gameKey: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7 drop-shadow-[0_0_6px_rgba(255,0,85,0.55)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      aria-hidden
    >
      {GLYPHS[gameKey] ?? GLYPHS["neon-snake"]}
    </svg>
  );
}

const STATUS_TONE: Record<GameEntry["status"], string> = {
  LIVE: "text-[#cbd5e1]",
  HOT: "text-[#ff2d6f]",
  NEW: "text-[#ffb42e]",
};

const FILTER_TABS = [
  { id: "all", label: "#ALL" },
  { id: "arcade", label: "#ARCADE" },
  { id: "racing", label: "#RACING" },
  { id: "puzzle", label: "#PUZZLE" },
  { id: "retro", label: "#RETRO" },
] as const;

type FilterId = (typeof FILTER_TABS)[number]["id"];

function GameCard({ game, slot }: { game: GameEntry; slot: number }) {
  return (
    <article className="group relative flex flex-col border border-red-900/40 bg-[#07070d] transition-all duration-300 hover:-translate-y-1.5 hover:border-red-500 hover:shadow-[0_18px_44px_rgba(0,0,0,0.6),0_0_32px_rgba(255,0,85,0.16)]">
      {/* hover hairline */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ff0055]/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      <div className="flex items-start justify-between gap-3 p-5 pb-0">
        {/* obsidian biomech icon badge with the title's neon glyph */}
        <span className="clip-corner grid h-14 w-14 place-items-center border border-red-900/60 bg-gradient-to-br from-[#0d0d18] to-[#050508] text-[#ff2d6f] shadow-[inset_0_0_20px_rgba(255,0,85,0.12)] transition-all duration-300 group-hover:text-[#ff5c8a] group-hover:shadow-[inset_0_0_24px_rgba(255,0,85,0.22),0_0_18px_rgba(255,0,85,0.25)]">
          <GameGlyph gameKey={game.key} />
        </span>
        <span
          className={`flex items-center gap-2 font-[JetBrains_Mono,monospace] text-[8px] font-bold tracking-[0.28em] ${
            STATUS_TONE[game.status]
          }`}
        >
          <span className="h-1.5 w-1.5 rotate-45 bg-current shadow-[0_0_8px_currentColor]" />
          {game.status}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="ultron-label text-[8px] font-bold tracking-[0.3em]">
          SLOT <span className="hud-accent">{"//"}</span> {String(slot).padStart(2, "0")}
        </p>
        <h3 className="mt-2.5 font-display text-base font-bold uppercase tracking-[0.1em] text-[#f8fafc] transition group-hover:text-white">
          {game.title}
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-[#64748b]">{game.tagline}</p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="font-[JetBrains_Mono,monospace] text-[9px] uppercase tracking-[0.22em] text-[#3f3f46]">
            {game.key}
          </span>
          {/* /index.html is the static arcade shell in /public — not an App Router page */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/index.html"
            className="btn-ultron-primary px-5 py-2 text-[10px]"
            aria-label={`Play ${game.title}`}
          >
            ▶ PLAY
          </a>
        </div>
      </div>
    </article>
  );
}

export function BiomechanicalGameGrid() {
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");

  /* client-side presentation filters — no data layer involved */
  const visibleBlocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORY_BLOCKS.map((block) => ({
      ...block,
      games: block.games.filter(
        (game) =>
          (filter === "all" || block.category === filter) &&
          (q === "" ||
            game.title.toLowerCase().includes(q) ||
            game.tagline.toLowerCase().includes(q) ||
            game.key.includes(q)),
      ),
    })).filter((block) => block.games.length > 0);
  }, [filter, query]);

  const visibleCount = visibleBlocks.reduce((n, block) => n + block.games.length, 0);

  return (
    <section id="game-deck" className="relative bg-[#050508] px-6 pb-24 pt-20 sm:px-10">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="tactical-grid absolute inset-0 opacity-60" />
        <div className="radial-obsidian absolute inset-0" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#050508] to-transparent" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        {/* ---------- deck header ---------- */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="ultron-label flex items-center gap-2 text-[10px] font-bold tracking-[0.4em] hud-accent">
              <span className="status-dot" />
              GAME DECK <span>{"//"}</span> {visibleCount} MODULES ONLINE
            </p>
            <h2 className="font-display mt-3 text-3xl font-black uppercase tracking-[0.12em] text-[#f8fafc] sm:text-4xl">
              SELECT YOUR{" "}
              <span className="text-[#ff0055] drop-shadow-[0_0_12px_rgba(255,0,85,0.5)]">MODULE</span>
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[#64748b]">
            Every module is housed in an obsidian biomech panel with a per-title neon glyph and live
            telemetry status. Play triggers route into the full arcade render core.
          </p>
        </div>

        {/* ---------- filter tabs + search ---------- */}
        <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" aria-label="Game category filters" className="flex flex-wrap items-center gap-2">
            {FILTER_TABS.map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(tab.id)}
                  className={`clip-tag border px-4 py-2 font-[JetBrains_Mono,monospace] text-[10px] font-bold uppercase tracking-[0.24em] transition-all ${
                    active
                      ? "border-[#ff0055]/70 bg-[#ff0055]/15 text-[#ff5c8a] shadow-[0_0_20px_rgba(255,0,85,0.35)]"
                      : "border-red-900/40 bg-[#07070d] text-[#94a3b8] hover:border-red-500/60 hover:text-[#ff5c8a]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-80">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#64748b]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m15.5 15.5 5 5" strokeLinecap="square" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SEARCH MODULES //"
              aria-label="Search games"
              className="w-full border border-red-900/40 bg-[#07070d] py-2.5 pl-10 pr-9 font-[JetBrains_Mono,monospace] text-[11px] tracking-[0.18em] text-[#f8fafc] outline-none transition-all placeholder:text-[#475569] focus:border-red-500 focus:shadow-[0_0_22px_rgba(255,0,85,0.25)] [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center text-[#64748b] transition hover:text-[#ff0055]"
              >
                ✕
              </button>
            ) : null}
          </div>
        </div>

        {/* ---------- category blocks ---------- */}
        <div className="mt-12 space-y-14">
          {visibleBlocks.map((block) => (
            <div key={block.index}>
              <div className="relative mb-7 flex items-baseline gap-4">
                <span className="clip-tag border border-red-900/60 bg-red-950/40 px-2.5 py-1 font-[JetBrains_Mono,monospace] text-[11px] font-bold text-[#ff0055]">
                  {block.index}
                </span>
                <h3 className="font-display text-xl font-bold uppercase tracking-[0.22em] text-[#f8fafc]">
                  {block.name}
                </h3>
                <span className="ml-auto font-[JetBrains_Mono,monospace] text-[9px] uppercase tracking-[0.26em] text-[#64748b]">
                  {block.games.length} MODULES // ARMED
                </span>
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-[-12px] h-px bg-gradient-to-r from-[#ff0055] via-red-900/50 to-transparent"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {block.games.map((game, i) => (
                  <GameCard key={game.key} game={game} slot={i + 1} />
                ))}
              </div>
            </div>
          ))}

          {/* ---------- empty state ---------- */}
          {visibleBlocks.length === 0 ? (
            <div className="ultron-frame px-6 py-16 text-center">
              <p className="font-display text-lg font-bold uppercase tracking-[0.2em] text-[#f8fafc]">
                NO MODULES MATCH
              </p>
              <p className="ultron-label mt-3 text-[9px] tracking-[0.34em]">
                {"// ADJUST THE FILTER OR SEARCH QUERY //"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                }}
                className="btn-ultron-secondary mt-7 px-7 py-3 text-[10px]"
              >
                RESET FILTERS
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
