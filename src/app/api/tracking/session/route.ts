import { db } from "@/db";
import { users, userProfiles, userSessions } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { ok, fail, preflight, readJson, getAuthUser, clampInt } from "@/lib/api";
import { ensureSeed } from "@/db/seed";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * POST /api/tracking/session — create or heartbeat a play session.
 * Body: { action: "start" | "beat", deviceSignature, activeSeconds, idleSeconds }
 * Auth: optional Bearer JWT (guests get a guest session id).
 */
export async function POST(req: Request) {
  try {
    await ensureSeed();
    /* sendBeacon posts with a text/plain body — parse it as JSON too. */
    let body = await readJson(req);
    if (!body) {
      try {
        const text = await req.clone().text();
        body = text ? (JSON.parse(text) as Record<string, unknown>) : null;
      } catch { body = null; }
    }
    if (!body) return fail(400, "Invalid JSON body.");

    const action = String(body.action ?? "start");
    const device = String(body.deviceSignature ?? "").slice(0, 96) || null;
    const activeSeconds = clampInt(body.activeSeconds, 0, 86_400, 0);
    const idleSeconds = clampInt(body.idleSeconds, 0, 86_400, 0);
    const user = await getAuthUser(req);

    if (action === "beat") {
      const sessionId = String(body.sessionId ?? "");
      if (!sessionId) return fail(400, "sessionId required for heartbeat.");
      await db
        .update(userSessions)
        .set({
          lastActiveAt: new Date(),
          activeTimeSeconds: sql`${userSessions.activeTimeSeconds} + ${activeSeconds}`,
          idleTimeSeconds: sql`${userSessions.idleTimeSeconds} + ${idleSeconds}`,
        })
        .where(eq(userSessions.id, sessionId));
      return ok({ ok: true, beating: true });
    }

    if (action === "close") {
      const sessionId = String(body.sessionId ?? "");
      const status = String(body.status ?? "CLOSED");
      if (!sessionId) return fail(400, "sessionId required to close.");
      const final = status === "TIMED_OUT" ? "TIMED_OUT" : "CLOSED";
      await db
        .update(userSessions)
        .set({ status: final, lastActiveAt: new Date() })
        .where(eq(userSessions.id, sessionId));
      return ok({ ok: true, closed: true, status: final });
    }

    // default: "start"
    const inserted = await db
      .insert(userSessions)
      .values({
        userId: user?.id ?? null, // guest sessions are valid and remain anonymous
        deviceSignature: device,
        status: "ACTIVE",
      })
      .returning({ id: userSessions.id });

    if (user) {
      await db
        .update(userProfiles)
        .set({
          totalLoginCount: sql`${userProfiles.totalLoginCount} + 1`,
          lastLoginAt: new Date(),
          ...(device ? { deviceSignature: device } : {}),
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, user.id));
    }

    return ok({ ok: true, sessionId: inserted[0]?.id ?? null, authed: !!user }, 201);
  } catch (err) {
    console.error("[api/tracking/session]", err);
    return fail(500, "Could not start session.");
  }
}
