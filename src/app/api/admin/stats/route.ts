import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ok, fail, preflight, requireAdmin } from "@/lib/api";
import { ensureSeed } from "@/db/seed";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

type Row = Record<string, unknown>;
function rowsOf(res: unknown): Row[] {
  if (Array.isArray(res)) return res as Row[];
  const maybe = res as { rows?: Row[] };
  return Array.isArray(maybe?.rows) ? maybe.rows : [];
}

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "Admin authorization required.");

    await ensureSeed();

    const userStats = rowsOf(
      await db.execute(sql`
        select
          count(*)::int as total_users,
          count(*) filter (where created_at >= now() - interval '24 hours')::int as signups_24h,
          count(*) filter (where created_at >= now() - interval '7 days')::int as signups_7d,
          coalesce(avg(total_xp), 0)::int as avg_xp
        from users
      `),
    );

    const scoreStats = rowsOf(
      await db.execute(sql`
        select
          count(*)::int as total_scores,
          count(distinct user_id) filter (where created_at >= now() - interval '24 hours')::int as active_sessions_24h,
          coalesce(max(score), 0)::int as global_record
        from scores
      `),
    );

    const recordHolder = rowsOf(
      await db.execute(sql`
        select s.score, u.username, g.title as game_title
        from scores s
        join users u on u.id = s.user_id
        join games g on g.id = s.game_id
        order by s.score desc, s.created_at asc
        limit 1
      `),
    );

    const signupsRaw = rowsOf(
      await db.execute(sql`
        select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*)::int as c
        from users
        where created_at >= now() - interval '6 days'
        group by 1
        order by 1
      `),
    );

    const gameCount = rowsOf(
      await db.execute(sql`select count(*)::int as c from games`),
    );

    // Build a continuous 7-day series ending today (UTC).
    const byDay = new Map<string, number>();
    for (const r of signupsRaw) byDay.set(String(r.day), Number(r.c) || 0);
    const signupsByDay: { day: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      signupsByDay.push({ day: key, count: byDay.get(key) ?? 0 });
    }

    const u = userStats[0] ?? {};
    const s = scoreStats[0] ?? {};
    const rec = recordHolder[0];

    return ok({
      ok: true,
      stats: {
        totalUsers: Number(u.total_users ?? 0),
        signups24h: Number(u.signups_24h ?? 0),
        signups7d: Number(u.signups_7d ?? 0),
        avgXp: Number(u.avg_xp ?? 0),
        totalScores: Number(s.total_scores ?? 0),
        activeSessions24h: Number(s.active_sessions_24h ?? 0),
        globalRecord: Number(s.global_record ?? 0),
        globalRecordHolder: rec
          ? { username: String(rec.username), score: Number(rec.score), game: String(rec.game_title) }
          : null,
        gamesCount: Number(gameCount[0]?.c ?? 0),
        signupsByDay,
      },
    });
  } catch (err) {
    console.error("[api/admin/stats]", err);
    return fail(500, "Could not load admin stats.");
  }
}
