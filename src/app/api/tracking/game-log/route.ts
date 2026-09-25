import { db } from "@/db";
import { gameActivityLogs } from "@/db/schema";
import { ok, fail, preflight, readJson, getAuthUser, clampInt } from "@/lib/api";
import { ensureSeed } from "@/db/seed";
import { proofHmac, validateScore, normalizeOutcome, clientChecksum } from "@/lib/telemetry";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * POST /api/tracking/game-log — record a finished game session.
 * Anti-cheat: requires a valid client HMAC checksum AND a plausible
 * score velocity. Idempotent via sessionKey (safe to replay after offline).
 */
export async function POST(req: Request) {
  try {
    await ensureSeed();
    const body = await readJson(req);
    if (!body) return fail(400, "Invalid JSON body.");

    const sessionKey = String(body.sessionKey ?? "").slice(0, 64);
    const gameKey = String(body.gameKey ?? "").slice(0, 64);
    const gameName = String(body.gameName ?? gameKey).slice(0, 128);
    const startTime = String(body.startTime ?? "");
    const endTime = String(body.endTime ?? "");
    const status = normalizeOutcome(body.status);
    const finalScore = clampInt(body.finalScore, 0, 50_000_000, -1);
    const durationSeconds = clampInt(body.durationSeconds, 0, 86_400, 0);
    const checksum = String(body.checksum ?? "");

    if (!sessionKey || !gameKey || !startTime || !endTime || !status || finalScore < 0) {
      return fail(400, "Missing or invalid telemetry fields.");
    }
    if (normalizeOutcome(status) !== status) return fail(400, "Could not parse game outcome.");

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end.getTime() < start.getTime()) {
      return fail(400, "Invalid start/end timestamps.");
    }

    /* Anti-cheat #1 — payload integrity. Accepts the server HMAC OR the
       browser's keyed proof-of-play checksum; both bind the payload. */
    const expectedHmac = proofHmac({ sessionKey, gameKey, startTime, endTime, status, finalScore });
    const clientProof = clientChecksum({ sessionKey, gameKey, startTime, endTime, status, finalScore });
    if (!checksum || (checksum !== expectedHmac && checksum !== clientProof)) {
      return fail(422, "Checksum mismatch — telemetry rejected as tampered.");
    }

    /* Anti-cheat #2 — theoretical score boundary. */
    if (!validateScore(gameKey, finalScore, durationSeconds)) {
      return fail(422, "Score exceeds the theoretical boundary for this game.");
    }

    const velocity = durationSeconds > 0 ? (finalScore / durationSeconds) : finalScore;
    const user = await getAuthUser(req);

    await db.insert(gameActivityLogs).values({
      sessionKey,
      userId: user?.id ?? null,
      gameKey,
      gameName,
      startTime: start,
      endTime: end,
      durationSeconds,
      status,
      finalScore,
      scoreVelocity: Number(velocity.toFixed(4)),
      checksum: expectedHmac, // authoritative server-side HMAC/SHA-256 ledger proof
    }).onConflictDoNothing({ target: gameActivityLogs.sessionKey });

    return ok({ ok: true, recorded: true, velocity: Number(velocity.toFixed(2)) }, 201);
  } catch (err) {
    console.error("[api/tracking/game-log]", err);
    return fail(500, "Could not record game log.");
  }
}
