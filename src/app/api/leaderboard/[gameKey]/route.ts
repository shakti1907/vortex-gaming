import { db } from "@/db";
import { gameActivityLogs, games, scores, users } from "@/db/schema";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { ok, fail, preflight, getAuthUser } from "@/lib/api";
import { ensureSeed } from "@/db/seed";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * Global leaderboard — anti-cheat-validated activity logs are authoritative.
 * ?scope=session returns the signed plays made by the current authenticated
 * player during this browser session (session keys supplied by the client).
 * Legacy scores are used only when a title has no validated telemetry yet.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ gameKey: string }> },
) {
  try {
    await ensureSeed();
    const { gameKey } = await ctx.params;
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") === "session" ? "session" : "global";

    const gameRows = await db.select().from(games).where(eq(games.key, gameKey)).limit(1);
    const game = gameRows[0];
    if (!game) return fail(404, "Unknown game.");

    const auth = scope === "session" ? await getAuthUser(req) : null;
    if (scope === "session" && !auth) return fail(401, "Sign in to view your session board.");

    const where = scope === "session" && auth
      ? and(eq(gameActivityLogs.gameKey, gameKey), eq(gameActivityLogs.userId, auth.id), ne(gameActivityLogs.status, "QUIT"))
      : and(eq(gameActivityLogs.gameKey, gameKey), ne(gameActivityLogs.status, "QUIT"));

    const validated = await db
      .select({
        username: users.username,
        score: gameActivityLogs.finalScore,
        createdAt: gameActivityLogs.createdAt,
        outcome: gameActivityLogs.status,
        velocity: gameActivityLogs.scoreVelocity,
      })
      .from(gameActivityLogs)
      .innerJoin(users, eq(gameActivityLogs.userId, users.id))
      .where(where)
      .orderBy(desc(gameActivityLogs.finalScore), asc(gameActivityLogs.createdAt))
      .limit(10);

    if (validated.length > 0 || scope === "session") {
      return ok({
        ok: true,
        source: "validated-telemetry",
        scope,
        game: { key: game.key, title: game.title, tagline: game.tagline },
        entries: validated.map((e, i) => ({ rank: i + 1, xpEarned: 0, ...e })),
      });
    }

    // Backward-compatible fallback for pre-v3 scores that have no signed log.
    const legacy = await db
      .select({
        username: users.username,
        score: scores.score,
        xpEarned: scores.xpEarned,
        createdAt: scores.createdAt,
      })
      .from(scores)
      .innerJoin(users, eq(scores.userId, users.id))
      .where(eq(scores.gameId, game.id))
      .orderBy(desc(scores.score), asc(scores.createdAt))
      .limit(10);

    return ok({
      ok: true,
      source: "legacy-scores",
      scope,
      game: { key: game.key, title: game.title, tagline: game.tagline },
      entries: legacy.map((e, i) => ({ rank: i + 1, ...e })),
    });
  } catch (err) {
    console.error("[api/leaderboard]", err);
    return fail(500, "Could not load leaderboard.");
  }
}
