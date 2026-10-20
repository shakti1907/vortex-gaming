"use client";

/* ==================================================================
   BiomechanicalGameGrid — presentation layer for the sixteen arcade
   titles. Pure display: every card is a .ultron-frame HUD container
   with hover elevation, a pulsing neon status indicator and a clean
   play trigger that routes into the untouched arcade at /index.html.
   No game logic, state handlers or data bindings live here.
   ================================================================== */

type GameEntry = {
  key: string;
  title: string;
  tagline: string;
  status: "LIVE" | "HOT" | "NEW";
};

type CategoryBlock = {
  index: string;
  name: string;
  games: GameEntry[];
};

const CATEGORY_BLOCKS: CategoryBlock[] = [
  {
    index: "01",
    name: "ACTION / ARCADE",
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
    games: [
      { key: "outrun-drive", title: "Outrun 2D Drive", tagline: "Pseudo-3D synthwave highway with nitro burn.", status: "LIVE" },
      { key: "cyber-drift", title: "Cyber Drift", tagline: "Break traction and bank the drift multiplier.", status: "LIVE" },
      { key: "hyper-speed-dodge", title: "Hyper Speed Dodge", tagline: "First-person wireframe tunnel at terminal velocity.", status: "HOT" },
      { key: "grid-dash", title: "Grid Dash", tagline: "Beat-locked jumps and slides over laser hazards.", status: "NEW" },
    ],
  },
];

const STATUS_TONE: Record<GameEntry["status"], string> = {
  LIVE: "text-[#00f3ff]",
  HOT: "text-[#ff0055]",
  NEW: "text-[#ffb42e]",
};

function GameCard({ game, slot }: { game: GameEntry; slot: number }) {
  return (
    <article className="ultron-frame group flex flex-col px-5 pb-5 pt-4 transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_22px_48px_rgba(0,0,0,0.55)]">
      <div className="flex items-center justify-between gap-3">
        <p className="ultron-label text-[8px] font-bold tracking-[0.3em]">
          SLOT // {String(slot).padStart(2, "0")}
        </p>
        <p className={`flex items-center gap-2 font-[JetBrains_Mono,monospace] text-[8px] font-bold tracking-[0.28em] ${STATUS_TONE[game.status]}`}>
          <span className="status-dot" />
          {game.status}
        </p>
      </div>

      <h3 className="mt-4 font-[JetBrains_Mono,monospace] text-base font-bold uppercase tracking-[0.12em] text-[#f8fafc]">
        {game.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-[#64748b]">{game.tagline}</p>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="font-[JetBrains_Mono,monospace] text-[9px] uppercase tracking-[0.22em] text-[#334155]">
          {game.key}
        </span>
        <a
          href="/index.html"
          className="btn-ultron-primary px-5 py-2 text-[10px]"
          aria-label={`Play ${game.title}`}
        >
          ▶ PLAY
        </a>
      </div>
    </article>
  );
}

export function BiomechanicalGameGrid() {
  return (
    <section id="game-deck" className="relative bg-[#05070a] px-6 pb-16 pt-20 sm:px-10">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="ultron-grid absolute inset-0 opacity-60" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#05070a] to-transparent" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="ultron-label flex items-center gap-2 text-[10px] font-bold tracking-[0.4em] text-[#00f3ff]">
              <span className="status-dot" />
              GAME DECK // 16 TITLES ONLINE
            </p>
            <h2 className="mt-3 font-[JetBrains_Mono,monospace] text-3xl font-black uppercase tracking-[0.12em] text-[#f8fafc] sm:text-4xl">
              SELECT YOUR <span className="text-[#ff0055]">MODULE</span>
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[#64748b]">
            Every module is housed in a biomechanical HUD frame with live telemetry status.
            Play triggers route into the full arcade render core.
          </p>
        </div>

        <div className="mt-12 space-y-14">
          {CATEGORY_BLOCKS.map((block) => (
            <div key={block.index}>
              <div className="relative mb-7 flex items-baseline gap-4">
                <span className="rounded-md border border-[color:var(--hud-accent-line)] bg-[color:var(--hud-accent-soft)] px-2.5 py-1 font-[JetBrains_Mono,monospace] text-[11px] font-bold text-[#ff0055]">
                  {block.index}
                </span>
                <h3 className="font-[JetBrains_Mono,monospace] text-xl font-bold uppercase tracking-[0.22em] text-[#f8fafc]">
                  {block.name}
                </h3>
                <span className="ml-auto font-[JetBrains_Mono,monospace] text-[9px] uppercase tracking-[0.26em] text-[#64748b]">
                  {block.games.length} MODULES // ARMED
                </span>
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-[-12px] h-px bg-gradient-to-r from-[#ff0055] via-[color:var(--hud-accent-line)] to-transparent"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {block.games.map((game, i) => (
                  <GameCard key={game.key} game={game} slot={i + 1} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
