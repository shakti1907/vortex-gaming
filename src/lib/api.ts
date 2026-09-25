import jwt from "jsonwebtoken";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/* Shared REST API toolkit: CORS, JSON envelopes, JWT auth, validation */
/* ------------------------------------------------------------------ */

export const JWT_SECRET = process.env.JWT_SECRET ?? "vortex-dev-secret-change-me";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function ok<T>(data: T, status = 200): Response {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

export function fail(status: number, message: string, extra?: Record<string, unknown>): Response {
  return Response.json({ ok: false, error: message, ...extra }, { status, headers: CORS_HEADERS });
}

/** CORS preflight handler shared by every route: `export const OPTIONS = preflight;` */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export type AuthUser = {
  id: string;
  username: string;
  role: string;
  status: string;
  totalXp: number;
};

export function signToken(user: { id: string; username: string; role: string }): string {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

/** Resolves the `Authorization: Bearer <jwt>` header against the users table. */
export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub?: string };
    if (!payload.sub) return null;
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        status: users.status,
        totalXp: users.totalXp,
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    const user = rows[0];
    if (!user || user.status === "banned") return null;
    return user;
  } catch {
    return null;
  }
}

/** Admin gate — returns the admin user or null (caller responds 401/403). */
export async function requireAdmin(req: Request): Promise<AuthUser | null> {
  const user = await getAuthUser(req);
  return user && user.role === "admin" ? user : null;
}

/* ----------------------- input validation -------------------------- */

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function isValidUsername(username: string): boolean {
  return /^[A-Za-z0-9_-]{3,24}$/.test(username);
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
