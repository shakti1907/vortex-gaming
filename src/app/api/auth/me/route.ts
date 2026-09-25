import { db } from "@/db";
import { users, userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ok, fail, preflight, getAuthUser } from "@/lib/api";
import { levelFromXp } from "@/db/seed";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return fail(401, "Authentication required.");

    const infoRows = await db
      .select({ email: users.email, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, auth.id))
      .limit(1);

    const profileRows = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, auth.id))
      .limit(1);

    const info = infoRows[0];
    const profile = profileRows[0] ?? null;

    return ok({
      ok: true,
      user: {
        id: auth.id,
        username: auth.username,
        email: info?.email ?? "",
        role: auth.role,
        status: auth.status,
        totalXp: auth.totalXp,
        level: levelFromXp(auth.totalXp),
        joinedAt: info?.createdAt ?? null,
      },
      profile,
    });
  } catch (err) {
    console.error("[api/auth/me]", err);
    return fail(500, "Could not load profile.");
  }
}
