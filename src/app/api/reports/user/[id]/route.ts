import { db } from "@/db";
import { gameActivityLogs, receiptAudits, users, userProfiles } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { ok, fail, preflight, getAuthUser } from "@/lib/api";
import { ensureSeed, levelFromXp } from "@/db/seed";
import { formatToIST, istHour, makeReceiptNumber, makeReceiptHash, sha256 } from "@/lib/telemetry";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * GET /api/reports/user/:id — activity telemetry + a verifiable receipt.
 * Only the owner or an admin may read it.
 * Query: ?receipt=1 → also mints a receipt audit and returns its hash + QR data.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const auth = await getAuthUser(req);
    if (!auth || (auth.id !== id && auth.role !== "admin")) {
      return fail(401, "You may only read your own report.");
    }
    await ensureSeed();

    const userRows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const u = userRows[0];
    if (!u) return fail(404, "User not found.");
    const profileRows = await db.select().from(userProfiles).where(eq(userProfiles.userId, id)).limit(1);
    const p = profileRows[0];

    const logs = await db
      .select()
      .from(gameActivityLogs)
      .where(eq(gameActivityLogs.userId, id))
      .orderBy(desc(gameActivityLogs.createdAt))
      .limit(60);

    /* ---- KPI aggregation ---- */
    let wins = 0, losses = 0, quits = 0, totalTime = 0, highScore = 0, longest = 0, nightOwlGames = 0;
    const gameFreq: Record<string, { plays: number; wins: number; totalDur: number; scoreSum: number; bestScore: number }> = {};
    const hourFreq = new Array(24).fill(0);

    for (const l of logs) {
      totalTime += l.durationSeconds;
      highScore = Math.max(highScore, l.finalScore);
      longest = Math.max(longest, l.durationSeconds);
      if (l.status === "WON") wins++;
      else if (l.status === "LOST") losses++;
      else quits++;

      const h = istHour(l.startTime);
      hourFreq[h]++;
      if (h >= 23 || h < 5) nightOwlGames++;

      const g = gameFreq[l.gameName] ?? (gameFreq[l.gameName] = { plays: 0, wins: 0, totalDur: 0, scoreSum: 0, bestScore: 0 });
      g.plays++;
      if (l.status === "WON") g.wins++;
      g.totalDur += l.durationSeconds;
      g.scoreSum += l.finalScore;
      g.bestScore = Math.max(g.bestScore, l.finalScore);
    }

    const gamesPlayed = logs.length;
    const winRate = gamesPlayed > 0 ? wins / gamesPlayed : 0;

    /* ---- achievement badges ---- */
    const badges = [
      { id: "night-owl", name: "Night Owl", desc: "Played between 11:00 PM and 5:00 AM IST", earned: nightOwlGames > 0 },
      { id: "sharpshooter", name: "Sharpshooter", desc: "Win ratio above 75% across 10+ games", earned: gamesPlayed >= 10 && winRate > 0.75 },
      { id: "marathoner", name: "Marathoner", desc: "Single session longer than 30 minutes", earned: longest >= 1800 },
      { id: "high-roller", name: "High Roller", desc: "Achieved a top-tier score on any game", earned: highScore >= 5000 },
    ];

    /* ---- optional receipt minting + verification payload ---- */
    const wantReceipt = new URL(req.url).searchParams.get("receipt") === "1";
    let receipt: {
      number: string; hash: string; generatedAtIST: string; verifyUrl: string;
    } | null = null;

    if (wantReceipt) {
      const number = makeReceiptNumber();
      const generatedAt = new Date();
      const hash = makeReceiptHash(id, number, generatedAt.toISOString());
      const payloadHash = sha256(JSON.stringify({
        id, gamesPlayed, wins, losses, highScore, totalTime, cnt: logs.length,
      }));
      await db.insert(receiptAudits).values({
        userId: id, receiptNumber: number, receiptHash: hash, payloadHash,
      }).onConflictDoNothing();

      const url = new URL(req.url);
      const origin = `${url.protocol}//${url.host}`;
      receipt = {
        number, hash,
        generatedAtIST: formatToIST(generatedAt),
        verifyUrl: `${origin}/api/verify-receipt?id=${hash}`,
      };
    }

    return ok({
      ok: true,
      identity: {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        status: u.status,
        totalXp: u.totalXp,
        level: levelFromXp(u.totalXp),
        registrationDate: formatToIST(u.createdAt),
        lastLoginAt: formatToIST(p?.lastLoginAt ?? u.createdAt),
        totalLoginCount: p?.totalLoginCount ?? 1,
      },
      kpis: {
        gamesPlayed, wins, losses, quits,
        winRatePct: Math.round(winRate * 100),
        highScore,
        totalPlaySeconds: totalTime,
        longestSessionSeconds: longest,
      },
      badges,
      receipt,
      gameBreakdown: Object.entries(gameFreq).map(([name, g]) => ({
        game: name, plays: g.plays, wins: g.wins,
        winRatePct: g.plays ? Math.round((g.wins / g.plays) * 100) : 0,
        avgDurationSec: Math.round(g.totalDur / g.plays),
        avgScore: Math.round(g.scoreSum / g.plays), bestScore: g.bestScore,
      })).sort((a, b) => b.plays - a.plays),
      hourHistogram: hourFreq,
      recent: logs.slice(0, 12).map((l) => ({
        id: l.id, game: l.gameName, outcome: l.status,
        score: l.finalScore, duration: l.durationSeconds,
        startIST: formatToIST(l.startTime), endIST: formatToIST(l.endTime),
      })),
    });
  } catch (err) {
    console.error("[api/reports/user]", err);
    return fail(500, "Could not build the activity report.");
  }
}
