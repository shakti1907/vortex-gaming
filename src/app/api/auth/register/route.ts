import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, userProfiles } from "@/db/schema";
import { or, eq } from "drizzle-orm";
import {
  ok,
  fail,
  preflight,
  readJson,
  isValidEmail,
  isValidUsername,
  signToken,
} from "@/lib/api";
import { ensureSeed } from "@/db/seed";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function POST(req: Request) {
  try {
    await ensureSeed();
    const body = await readJson(req);
    if (!body) return fail(400, "Invalid JSON body.");

    const username = String(body.username ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!isValidUsername(username))
      return fail(400, "Username must be 3-24 characters (letters, numbers, _ or -).");
    if (!isValidEmail(email)) return fail(400, "A valid email address is required.");
    if (password.length < 6 || password.length > 128)
      return fail(400, "Password must be between 6 and 128 characters.");

    const existing = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(or(eq(users.email, email), eq(users.username, username)))
      .limit(1);

    if (existing.length > 0) {
      if (existing[0]?.email === email) return fail(409, "That email is already registered.");
      return fail(409, "That username is taken.");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await db
      .insert(users)
      .values({ username, email, passwordHash })
      .returning({ id: users.id, role: users.role, createdAt: users.createdAt });

    const created = inserted[0];
    if (!created) return fail(500, "Could not create account.");

    await db
      .insert(userProfiles)
      .values({ userId: created.id, displayName: username })
      .onConflictDoNothing();

    const token = signToken({ id: created.id, username, role: created.role });
    return ok(
      {
        ok: true,
        token,
        user: {
          id: created.id,
          username,
          email,
          role: created.role,
          status: "active",
          totalXp: 0,
          level: 1,
          joinedAt: created.createdAt,
        },
      },
      201,
    );
  } catch (err) {
    console.error("[api/auth/register]", err);
    return fail(500, "Registration failed. Please try again.");
  }
}
