import { createHmac, createHash, randomUUID } from "crypto";

/* ------------------------------------------------------------------ */
/* VORTEX telemetry & anti-cheat toolkit                               */
/* ------------------------------------------------------------------ */

const PROOF_SECRET =
  process.env.PROOF_SECRET ?? process.env.JWT_SECRET ?? "vortex-dev-proof-secret";

/** HMAC used to verify client game-log payloads. */
export function proofHmac(payload: {
  sessionKey: string;
  gameKey: string;
  startTime: string;
  endTime: string;
  status: string;
  finalScore: number;
}): string {
  return createHmac("sha256", PROOF_SECRET)
    .update(
      [
        payload.sessionKey,
        payload.gameKey,
        payload.startTime,
        payload.endTime,
        payload.status,
        payload.finalScore,
      ].join("|"),
    )
    .digest("hex");
}

/** SHA-256 helper (receipt hashes, payload fingerprints). */
export function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Browser-compatible keyed proof-of-play checksum. Must match the algorithm
 * in public/js/vortex-telemetry.js → clientChecksum() exactly (pure JS 32-bit
 * FNV-style scramble, dual-lane). Node can reproduce it with Math.imul.
 */
export function clientChecksum(payload: {
  sessionKey: string;
  gameKey: string;
  startTime: string;
  endTime: string;
  status: string;
  finalScore: number;
}): string {
  const str = [
    payload.sessionKey, payload.gameKey, payload.startTime,
    payload.endTime, payload.status, payload.finalScore, "vortex",
  ].join("|");
  let h1 = 2166136261, h2 = 1199545199;
  for (let i = 0; i < str.length; i++) {
    h1 = Math.imul(h1 ^ str.charCodeAt(i), 16777619);
    h2 = Math.imul(h2 ^ str.charCodeAt(i), 1597334677);
  }
  return "c_" + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}

export function newId(): string {
  return randomUUID();
}

/**
 * Theoretical max points / second per game engine. A score above this
 * boundary is rejected server-side as manipulated. Keys must mirror the
 * client VortexGames registry.
 */
export const GAME_BOUNDS: Record<string, number> = {
  "neon-snake": 40,
  "cyber-invaders": 400,
  "asteroid-vector": 220,
  "bullet-hell-rush": 300,
  "grid-stacker": 200,
  "quantum-laser": 300,
  "memory-matrix": 220,
  "neon-flow": 120,
  "neon-pong": 260,
  "grid-pac-runner": 200,
  "cyber-soar": 200,
  "retro-defender": 260,
  "outrun-drive": 220,
  "cyber-drift": 120,
  "hyper-speed-dodge": 220,
  "grid-dash": 200,
  default: 600,
};

export function maxVelocityFor(gameKey: string): number {
  return GAME_BOUNDS[gameKey] ?? GAME_BOUNDS.default;
}

/** True if (score, duration) plausibly came from legitimate play. */
export function validateScore(gameKey: string, finalScore: number, durationSeconds: number): boolean {
  if (!Number.isFinite(finalScore) || finalScore < 0) return false;
  if (finalScore === 0) return true;                      // zero is always plausible
  const dur = Math.max(1, durationSeconds);
  return finalScore / dur <= maxVelocityFor(gameKey);
}

/** Human canonical outcome → stored enum. */
export function normalizeOutcome(s: unknown): "WON" | "LOST" | "QUIT" | null {
  const v = String(s ?? "").toUpperCase();
  if (v === "WON" || v === "WIN") return "WON";
  if (v === "LOST" || v === "LOSE" || v === "LOSS" || v === "DIED" || v === "GAMEOVER") return "LOST";
  if (v === "QUIT" || v === "ABANDON" || v === "EXIT") return "QUIT";
  return null;
}

/* ------------------------------------------------------------------ */
/* INDIAN STANDARD TIME formatting (display only — storage stays UTC)  */
/* ------------------------------------------------------------------ */
export function formatToIST(iso: string | Date | null | undefined): string {
  if (!iso) return "N/A";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return "N/A";
  return (
    d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }) + " IST"
  );
}

/** Hour of day (0-23) in IST — used by the Night Owl badge + peak analytics. */
export function istHour(iso: string | Date): number {
  const s = new Date(iso).toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false });
  return parseInt(s, 10) || 0;
}

/* ------------------------------------------------------------------ */
/* Receipt ID + hash                                                  */
/* ------------------------------------------------------------------ */
export function makeReceiptNumber(): string {
  const year = new Date().getUTCFullYear();
  const seq = 10000 + Math.floor(Math.random() * 90000);
  return `#VTX-${year}-${seq}`;
}

export function makeReceiptHash(userId: string, receiptNumber: string, generatedAt: string): string {
  return sha256([userId, receiptNumber, generatedAt, PROOF_SECRET].join("|"));
}
