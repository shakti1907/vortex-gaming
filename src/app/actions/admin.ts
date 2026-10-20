"use server";

import { cookies, headers } from "next/headers";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { gameActivityLogs, games, scores, users } from "@/db/schema";
import { requireAdmin } from "@/lib/api";

/* ==================================================================
   Admin telemetry actions — read-only queries behind an admin gate.
   Auth reuses the existing JWT session (cookie `vortex_session` set by
   /api/auth/login, or an `Authorization: Bearer` header forwarded by
   the terminal). No schema changes, no writes.
   ================================================================== */

const MAX_ROWS = 25;

function requestWithToken(token: string): Request {
  return new Request("https://vortex.internal/admin/action", {
    headers: { authorization: `Bearer ${token}` },
  });
}

async function resolveAdmin() {
  const store = await cookies();
  const reqHeaders = await headers();
  const bearer = reqHeaders.get("authorization") ?? "";
  const token = bearer.startsWith("Bearer ")
    ? bearer.slice(7).trim()
    : (store.get("vortex_session")?.value ?? "");
  if (!token) return null;
  return requireAdmin(requestWithToken(token));
}

/**
 * `/data users` — registered user telemetry:
 * username, total XP, account creation timestamp.
 */
export async function adminFetchUsers(): Promise<
  | { ok: true; rows: Array<{ username: string; totalXp: number; createdAt: string }> }
  | { ok: false; error: string }
> {
  try {
    const admin = await resolveAdmin();
    if (!admin) return { ok: false, error: "ACCESS DENIED — ADMIN CREDENTIALS REQUIRED" };

    const rows = await db
      .select({
        username: users.username,
        totalXp: users.totalXp,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.totalXp), desc(users.createdAt))
      .limit(MAX_ROWS);

    return {
      ok: true,
      rows: rows.map((r) => ({
        username: r.username,
        totalXp: r.totalXp,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  } catch (err) {
    console.error("[actions/admin/users]", err);
    return { ok: false, error: "TELEMETRY LINK FAILURE — USER DATA UNAVAILABLE" };
  }
}

/**
 * `/data scores` — top high-score telemetry with verification flags.
 * `verified` marks scores that match a signed telemetry session log.
 */
export async function adminFetchScores(): Promise<
  | {
      ok: true;
      rows: Array<{
        rank: number;
        username: string;
        game: string;
        score: number;
        createdAt: string;
        verified: boolean;
      }>;
    }
  | { ok: false; error: string }
> {
  try {
    const admin = await resolveAdmin();
    if (!admin) return { ok: false, error: "ACCESS DENIED — ADMIN CREDENTIALS REQUIRED" };

    const rows = await db
      .select({
        userId: scores.userId,
        username: users.username,
        game: games.title,
        gameKey: games.key,
        score: scores.score,
        createdAt: scores.createdAt,
      })
      .from(scores)
      .innerJoin(users, eq(scores.userId, users.id))
      .innerJoin(games, eq(scores.gameId, games.id))
      .orderBy(desc(scores.score), desc(scores.createdAt))
      .limit(MAX_ROWS);

    /* verification flags: a score counts as verified when the ledger has a
       signed session row for the same pilot + game + final score */
    const userIds = Array.from(new Set(rows.map((r) => r.userId)));
    const logs =
      userIds.length > 0
        ? await db
            .select({
              userId: gameActivityLogs.userId,
              gameKey: gameActivityLogs.gameKey,
              finalScore: gameActivityLogs.finalScore,
            })
            .from(gameActivityLogs)
            .where(inArray(gameActivityLogs.userId, userIds))
            .limit(500)
        : [];

    const signed = new Set(
      logs
        .filter((l) => l.userId !== null)
        .map((l) => `${l.userId}|${l.gameKey}|${l.finalScore}`),
    );

    return {
      ok: true,
      rows: rows.map((r, i) => ({
        rank: i + 1,
        username: r.username,
        game: r.game,
        score: r.score,
        createdAt: r.createdAt.toISOString(),
        verified: signed.has(`${r.userId}|${r.gameKey}|${r.score}`),
      })),
    };
  } catch (err) {
    console.error("[actions/admin/scores]", err);
    return { ok: false, error: "TELEMETRY LINK FAILURE — SCORE DATA UNAVAILABLE" };
  }
}

/** `/ultron status` — cheap liveness probe used by the terminal boot. */
export async function adminPing(): Promise<{ ok: true; db: "up"; admin: string } | { ok: false; error: string }> {
  try {
    const admin = await resolveAdmin();
    if (!admin) return { ok: false, error: "ACCESS DENIED — ADMIN CREDENTIALS REQUIRED" };
    await db.execute(sql`select 1`);
    return { ok: true, db: "up", admin: admin.username };
  } catch (err) {
    console.error("[actions/admin/ping]", err);
    return { ok: false, error: "TELEMETRY LINK FAILURE — CORE OFFLINE" };
  }
}
