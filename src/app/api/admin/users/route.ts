import { db } from "@/db";
import { scores, users } from "@/db/schema";
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { ok, fail, preflight, requireAdmin, clampInt } from "@/lib/api";
import { ensureSeed, levelFromXp } from "@/db/seed";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) return fail(401, "Admin authorization required.");

    await ensureSeed();

    const url = new URL(req.url);
    const search = (url.searchParams.get("search") ?? "").trim().slice(0, 64);
    const status = (url.searchParams.get("status") ?? "all").trim();
    const page = clampInt(url.searchParams.get("page"), 1, 100_000, 1);
    const limit = clampInt(url.searchParams.get("limit"), 1, 50, 10);

    const conditions: SQL[] = [];
    if (search) {
      const pattern = `%${search.replace(/[%_]/g, "")}%`;
      const searchCond = or(ilike(users.username, pattern), ilike(users.email, pattern));
      if (searchCond) conditions.push(searchCond);
    }
    if (status === "active" || status === "banned") {
      conditions.push(eq(users.status, status));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const totalRows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(users)
      .where(whereClause);
    const total = Number(totalRows[0]?.c ?? 0);

    const pageRows = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        status: users.status,
        role: users.role,
        totalXp: users.totalXp,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const ids = pageRows.map((r) => r.id);
    const bestMap = new Map<string, number>();
    if (ids.length > 0) {
      const bestRows = await db
        .select({ userId: scores.userId, best: sql<number>`max(${scores.score})::int` })
        .from(scores)
        .where(inArray(scores.userId, ids))
        .groupBy(scores.userId);
      for (const b of bestRows) bestMap.set(b.userId, Number(b.best ?? 0));
    }

    return ok({
      ok: true,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      total,
      rows: pageRows.map((r) => ({
        id: r.id,
        username: r.username,
        email: r.email,
        joinedAt: r.createdAt,
        totalXp: r.totalXp,
        level: levelFromXp(r.totalXp),
        highScore: bestMap.get(r.id) ?? 0,
        status: r.status,
        role: r.role,
      })),
    });
  } catch (err) {
    console.error("[api/admin/users]", err);
    return fail(500, "Could not load users.");
  }
}
