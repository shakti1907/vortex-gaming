import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, userProfiles } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { ok, fail, preflight, readJson, signToken } from "@/lib/api";
import { ensureSeed, levelFromXp } from "@/db/seed";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function POST(req: Request) {
  try {
    await ensureSeed();
    const body = await readJson(req);
    if (!body) return fail(400, "Invalid JSON body.");

    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) return fail(400, "Email and password are required.");

    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];

    // Uniform error to prevent account enumeration.
    if (!user) return fail(401, "Invalid credentials.");

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) return fail(401, "Invalid credentials.");

    if (user.status === "banned") return fail(403, "This account has been suspended.");

    // Persistent user recognition: record the returning visit on the profile
    // row so the PostgreSQL backbone tracks logins reliably.
    try {
      const now = new Date();
      const profileRows = await db
        .select({ userId: userProfiles.userId })
        .from(userProfiles)
        .where(eq(userProfiles.userId, user.id))
        .limit(1);

      if (profileRows.length > 0) {
        await db
          .update(userProfiles)
          .set({
            lastLoginAt: now,
            totalLoginCount: sql`${userProfiles.totalLoginCount} + 1`,
            updatedAt: now,
          })
          .where(eq(userProfiles.userId, user.id));
      } else {
        await db
          .insert(userProfiles)
          .values({
            userId: user.id,
            displayName: user.username,
            lastLoginAt: now,
            totalLoginCount: 1,
          })
          .onConflictDoNothing();
      }
    } catch (err) {
      // never block authentication on telemetry bookkeeping
      console.error("[api/auth/login] profile touch failed", err);
    }

    const token = signToken({ id: user.id, username: user.username, role: user.role });
    return ok({
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        totalXp: user.totalXp,
        level: levelFromXp(user.totalXp),
        joinedAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("[api/auth/login]", err);
    return fail(500, "Login failed. Please try again.");
  }
}
