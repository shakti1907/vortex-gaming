import { db } from "@/db";
import { gameActivityLogs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { ok, fail, preflight, requireAdmin } from "@/lib/api";
import { formatToIST, istHour, maxVelocityFor } from "@/lib/telemetry";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

function escapeCsv(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /api/admin/telemetry?format=csv  → downloadable spreadsheet of game logs
 * GET /api/admin/telemetry             → popularity + peak-hour analytics (JSON)
 * Admin only.
 */
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "Admin authorization required.");

    const logs = await db
      .select()
      .from(gameActivityLogs)
      .orderBy(desc(gameActivityLogs.createdAt))
      .limit(5000);

    if (new URL(req.url).searchParams.get("format") === "csv") {
      const header = [
        "log_id", "user_id", "game_key", "game_name", "start_time_ist", "end_time_ist",
        "duration_seconds", "outcome", "final_score", "score_velocity", "recorded_ist",
      ];
      const lines = [header.join(",")];
      for (const l of logs) {
        lines.push([
          l.id, l.userId ?? "", l.gameKey, l.gameName,
          formatToIST(l.startTime), formatToIST(l.endTime),
          l.durationSeconds, l.status, l.finalScore, l.scoreVelocity,
          formatToIST(l.createdAt),
        ].map(escapeCsv).join(","));
      }
      const body = lines.join("\n");
      return new Response(body, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="vortex_telemetry.csv"',
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    /* ---- popularity + peak analytics ---- */
    const games: Record<string, { plays: number; wins: number; losses: number; quits: number; totalDur: number; scoreSum: number; velocities: number[] }> = {};
    const hourFreq = new Array(24).fill(0);
    let wins = 0, played = 0;

    for (const l of logs) {
      played++;
      if (l.status === "WON") wins++;
      hourFreq[istHour(l.startTime)]++;
      const g = games[l.gameName] ?? (games[l.gameName] = { plays: 0, wins: 0, losses: 0, quits: 0, totalDur: 0, scoreSum: 0, velocities: [] });
      g.plays++;
      if (l.status === "WON") g.wins++;
      else if (l.status === "LOST") g.losses++;
      else g.quits++;
      g.totalDur += l.durationSeconds;
      g.scoreSum += l.finalScore;
      const v = Number(l.scoreVelocity);
      if (!isNaN(v)) g.velocities.push(v);
    }

    const peakHour = hourFreq.indexOf(Math.max(...hourFreq));

    return ok({
      ok: true,
      totals: { played, wins, winRatePct: played ? Math.round((wins / played) * 100) : 0, peakHourIST: peakHour },
      hourHistogram: hourFreq,
      games: Object.entries(games).map(([name, g]) => {
        const avgVel = g.velocities.length ? g.velocities.reduce((a, b) => a + b, 0) / g.velocities.length : 0;
        const bound = maxVelocityFor(games[name] ? gKeyFor(name) : "");
        return {
          game: name,
          plays: g.plays,
          winRatePct: g.plays ? Math.round((g.wins / g.plays) * 100) : 0,
          avgDurationSec: Math.round(g.totalDur / g.plays),
          avgScore: Math.round(g.scoreSum / g.plays),
          avgVelocity: Number(avgVel.toFixed(2)),
          theoreticalBound: bound,
        };
      }).sort((a, b) => b.plays - a.plays),
    });
  } catch (err) {
    console.error("[api/admin/telemetry]", err);
    return fail(500, "Could not load telemetry.");
  }
}

const NAME_TO_KEY: Record<string, string> = {
  "Neon Snake": "neon-snake", "Cyber Invaders": "cyber-invaders", "Asteroid Vector": "asteroid-vector",
  "Bullet Hell Rush": "bullet-hell-rush", "Cyber Grid Stacker": "grid-stacker", "Quantum Laser Reflect": "quantum-laser",
  "Memory Matrix": "memory-matrix", "Neon Flow": "neon-flow", "Neon Pong 2.0": "neon-pong",
  "Grid Pac-Runner": "grid-pac-runner", "Cyber Soar": "cyber-soar", "Retro Defender": "retro-defender",
  "Outrun 2D Drive": "outrun-drive", "Cyber Drift": "cyber-drift", "Hyper Speed Dodge": "hyper-speed-dodge",
  "Grid Dash": "grid-dash",
};
function gKeyFor(name: string): string { return NAME_TO_KEY[name] ?? ""; }
