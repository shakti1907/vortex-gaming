import { db } from "@/db";
import { games, scores, users, userProfiles } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { ok, fail, preflight, readJson, getAuthUser, clampInt } from "@/lib/api";
import { ensureSeed, levelFromXp } from "@/db/seed";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function POST(req: Request) {
  try {
    await ensureSeed();
    const body = await readJson(req);
    if (!body) return fail(400, "Invalid JSON body.");

    const gameKey = String(body.gameKey ?? "").trim();
    const score = clampInt(body.score, 0, 50_000_000, -1);
    if (!gameKey) return fail(400, "gameKey is required.");
    if (score < 0) return fail(400, "score must be a non-negative integer.");

    const gameRows = await db.select().from(games).where(eq(games.key, gameKey)).limit(1);
    const game = gameRows[0];
    if (!game) return fail(400, "Unknown game key.");

    const user = await getAuthUser(req);

    // Guests play fully offline-first: the client persists the score in
    // localStorage and syncs it once authenticated.
    if (!user) {
      return ok({
        ok: true,
        saved: false,
        reason: "guest",
        message: "Score stored locally — sign in to sync to the global grid.",
      });
    }

    const xpEarned = clampInt(body.xpDelta, 0, 100_000, 0);

    await db.insert(scores).values({ userId: user.id, gameId: game.id, score, xpEarned });

    await db
      .update(users)
      .set({ totalXp: sql`${users.totalXp} + ${xpEarned}` })
      .where(eq(users.id, user.id));

    const newTotalXp = user.totalXp + xpEarned;
    const level = levelFromXp(newTotalXp);

    await db
      .insert(userProfiles)
      .values({
        userId: user.id,
        displayName: user.username,
        level,
        lastGameKey: gameKey,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: { level, lastGameKey: gameKey, updatedAt: new Date() },
      });

    const bestRows = await db
      .select({ best: sql<number>`max(${scores.score})::int` })
      .from(scores)
      .where(and(eq(scores.userId, user.id), eq(scores.gameId, game.id)));

    const highScore = bestRows[0]?.best ?? score;

    return ok({ ok: true, saved: true, totalXp: newTotalXp, level, highScore });
  } catch (err) {
    console.error("[api/scores/submit]", err);
    return fail(500, "Could not submit score.");
  }
}
