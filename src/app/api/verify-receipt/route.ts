import { db } from "@/db";
import { receiptAudits, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ok, fail, preflight } from "@/lib/api";
import { formatToIST } from "@/lib/telemetry";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/**
 * GET /api/verify-receipt?id=<receipt_hash>
 * Public, unauthenticated verification endpoint so anyone scanning the
 * QR code can confirm a receipt is genuine and read its headline data.
 */
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id || id.length < 16) return fail(400, "A receipt hash (?id=) is required.");

    const rows = await db
      .select({
        receiptNumber: receiptAudits.receiptNumber,
        generatedAt: receiptAudits.generatedAt,
        username: users.username,
      })
      .from(receiptAudits)
      .innerJoin(users, eq(receiptAudits.userId, users.id))
      .where(eq(receiptAudits.receiptHash, id))
      .limit(1);

    const r = rows[0];
    if (!r) return fail(404, "Receipt not found — it may be invalid or revoked.");

    return ok({
      ok: true,
      verified: true,
      receipt: {
        number: r.receiptNumber,
        generatedAtIST: formatToIST(r.generatedAt),
        player: r.username,
      },
      message: "This is an authentic VORTEX GAMING activity audit.",
    });
  } catch (err) {
    console.error("[api/verify-receipt]", err);
    return fail(500, "Verification failed.");
  }
}
