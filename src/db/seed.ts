import { db } from "@/db";
import { games, users, userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

/* ------------------------------------------------------------------ */
/* Canonical 16-game catalog — mirrored by the client manifest and     */
/* schema.sql seed block. Single source of truth for game keys/modes.  */
/* ------------------------------------------------------------------ */
export const GAME_CATALOG = [
  { key: "neon-snake", title: "Neon Snake", category: "Action / Arcade", mode: "snake", tagline: "Dash boosts, plasma trails, multi-stage cores." },
  { key: "cyber-invaders", title: "Cyber Invaders", category: "Action / Arcade", mode: "shooter", tagline: "Destructible shields and a sentinel boss core." },
  { key: "asteroid-vector", title: "Asteroid Vector", category: "Action / Arcade", mode: "vector", tagline: "360° inertia drift around a hungry singularity." },
  { key: "bullet-hell-rush", title: "Bullet Hell Rush", category: "Action / Arcade", mode: "bullet", tagline: "Procedural bullet storms — bend time to survive." },
  { key: "grid-stacker", title: "Cyber Grid Stacker", category: "Puzzle / Strategy", mode: "tetris", tagline: "Chain line clears before the gravity surge." },
  { key: "quantum-laser", title: "Quantum Laser Reflect", category: "Puzzle / Strategy", mode: "optics", tagline: "Rotate mirrors, bend the beam, light every node." },
  { key: "memory-matrix", title: "Memory Matrix", category: "Puzzle / Strategy", mode: "sequence", tagline: "Rhythmic sequence hacking through the glitch." },
  { key: "neon-flow", title: "Neon Flow", category: "Puzzle / Strategy", mode: "flow", tagline: "Route the power nodes — wires may never cross." },
  { key: "neon-pong", title: "Neon Pong 2.0", category: "Retro / Classic", mode: "pong", tagline: "Curve shots, paddle powerups, reactive walls." },
  { key: "grid-pac-runner", title: "Grid Pac-Runner", category: "Retro / Classic", mode: "maze", tagline: "Harvest data nodes, outwit the patrol sentinels." },
  { key: "cyber-soar", title: "Cyber Soar", category: "Retro / Classic", mode: "flyer", tagline: "Precision thruster flight through energy pillars." },
  { key: "retro-defender", title: "Retro Defender", category: "Retro / Classic", mode: "defense", tagline: "Intercept the warheads, save all six cities." },
  { key: "outrun-drive", title: "Outrun 2D Drive", category: "Racing / Speed", mode: "pseudo3d", tagline: "Pseudo-3D synthwave highway with nitro burn." },
  { key: "cyber-drift", title: "Cyber Drift", category: "Racing / Speed", mode: "drift", tagline: "Break traction and bank the drift multiplier." },
  { key: "hyper-speed-dodge", title: "Hyper Speed Dodge", category: "Racing / Speed", mode: "tunnel", tagline: "First-person wireframe tunnel at terminal velocity." },
  { key: "grid-dash", title: "Grid Dash", category: "Racing / Speed", mode: "rhythm", tagline: "Beat-locked jumps and slides over laser hazards." },
] as const;

export const DEFAULT_ADMIN = {
  username: "vortex_admin",
  email: "admin@vortex.gg",
};

/* ------------------------------------------------------------------ */
/* Level curve — MUST stay in sync with js/vortex-gamification.js:     */
/* level N requires cumulative XP of 100*N + 50*N*(N-1)/2              */
/* ------------------------------------------------------------------ */
export function levelFromXp(xp: number): number {
  let level = 1;
  let need = 100;
  let remaining = Math.max(0, Math.floor(xp));
  while (remaining >= need && level < 999) {
    remaining -= need;
    level += 1;
    need = 100 + (level - 1) * 50;
  }
  return level;
}

let seedPromise: Promise<void> | null = null;

/** Idempotent seed — safe to call from every route. Retries on failure. */
export function ensureSeed(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<void> {
  await db
    .insert(games)
    .values(GAME_CATALOG.map((g) => ({ ...g })))
    .onConflictDoNothing({ target: games.key });

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEFAULT_ADMIN.email))
    .limit(1);

  if (existing.length === 0) {
    const password = process.env.ADMIN_PASSWORD ?? "VortexAdmin#2026";
    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await db
      .insert(users)
      .values({
        username: DEFAULT_ADMIN.username,
        email: DEFAULT_ADMIN.email,
        passwordHash,
        role: "admin",
        status: "active",
      })
      .returning({ id: users.id });

    const adminId = inserted[0]?.id;
    if (adminId) {
      await db
        .insert(userProfiles)
        .values({ userId: adminId, displayName: "Vortex Admin", avatarHue: 45 })
        .onConflictDoNothing();
    }
  }
}
