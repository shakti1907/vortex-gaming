import { db } from "@/db";
import { sql } from "drizzle-orm";
import { ok, preflight } from "@/lib/api";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return ok({ ok: true, service: "vortex-gaming", db: "up", time: new Date().toISOString() });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 500 });
  }
}
