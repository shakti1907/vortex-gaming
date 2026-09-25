import PDFDocument from "pdfkit";
import { ok, fail, preflight, readJson, getAuthUser } from "@/lib/api";
import { formatToIST } from "@/lib/telemetry";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

function duration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}

/** Build a compact, ink-safe activity receipt as a real PDF attachment. */
async function buildPdf(report: Record<string, any>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42, info: { Title: "VORTEX GAMING Activity Audit" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const identity = report.identity;
    const kpis = report.kpis;
    const receipt = report.receipt;
    doc.font("Helvetica-Bold").fontSize(15).fillColor("#b3004d").text("VORTEX GAMING OFFICIAL ACTIVITY AUDIT");
    doc.moveDown(0.35).fontSize(22).fillColor("#14101f").text(receipt?.number ?? "#VTX-AUDIT");
    doc.font("Helvetica").fontSize(9).fillColor("#666666").text(`Generated ${receipt?.generatedAtIST ?? formatToIST(new Date())}`);
    doc.moveDown().strokeColor("#b3004d").lineWidth(1.5).moveTo(42, doc.y).lineTo(553, doc.y).stroke();

    doc.moveDown().font("Helvetica-Bold").fontSize(10).fillColor("#14101f").text(`PLAYER  ${identity.username}`);
    doc.font("Helvetica").text(`Email: ${identity.email}`);
    doc.text(`Registered: ${identity.registrationDate}  |  Login count: ${identity.totalLoginCount}`);
    doc.moveDown().font("Helvetica-Bold").text(
      `Games ${kpis.gamesPlayed}   |   Win rate ${kpis.winRatePct}%   |   High score ${Number(kpis.highScore).toLocaleString()}   |   Total time ${duration(kpis.totalPlaySeconds)}`,
    );

    doc.moveDown(1.2).fontSize(11).fillColor("#0066aa").text("ITEMIZED GAME ACTIVITY");
    doc.moveDown(0.4).fontSize(8).fillColor("#333333");
    const rows = Array.isArray(report.recent) ? report.recent : [];
    if (!rows.length) doc.text("No validated game activity has been recorded yet.");
    for (const r of rows.slice(0, 14)) {
      const y = doc.y;
      doc.font("Helvetica-Bold").text(String(r.game).slice(0, 23), 42, y, { width: 130 });
      doc.font("Helvetica").text(`${r.outcome} | ${duration(r.duration)}`, 180, y, { width: 95 });
      doc.text(String(r.startIST).slice(0, 31), 280, y, { width: 185 });
      doc.font("Helvetica-Bold").text(Number(r.score).toLocaleString(), 475, y, { width: 70, align: "right" });
      doc.moveDown(1.05).strokeColor("#dddddd").lineWidth(0.4).moveTo(42, doc.y).lineTo(553, doc.y).stroke();
      doc.moveDown(0.35);
    }

    const earned = (report.badges ?? []).filter((b: { earned: boolean }) => b.earned).map((b: { name: string }) => b.name);
    doc.moveDown().font("Helvetica-Bold").fontSize(10).fillColor("#a35c00").text(`ACHIEVEMENTS  ${earned.length ? earned.join("  |  ") : "No badges earned yet"}`);
    doc.moveDown().font("Helvetica").fontSize(7.5).fillColor("#666666").text(`Verify: ${receipt?.verifyUrl ?? "N/A"}`);
    doc.text(`Receipt hash: ${receipt?.hash ?? "N/A"}`);
    doc.text("All displayed timestamps use Indian Standard Time (Asia/Kolkata). Database records remain UTC ISO 8601.");
    doc.end();
  });
}

/**
 * POST /api/reports/email — queue a copy of the user's activity report to
 * their registered address. Works via an optional HTTP mail relay:
 *   MAIL_RELAY_URL   (e.g. https://api.sendgrid.com/v3/mail/send)
 *   MAIL_RELAY_KEY   (Authorization: Bearer <key>)
 * If no relay is configured, returns 503 with a clear message instead of
 * failing silently.
 */
export async function POST(req: Request) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return fail(401, "Sign in to email yourself a report.");
    const body = await readJson(req);
    if (!body) return fail(400, "Invalid JSON body.");
    const userId = String(body.userId ?? auth.id);
    if (userId !== auth.id && auth.role !== "admin") return fail(401, "You may only email your own report.");

    const relayUrl = process.env.MAIL_RELAY_URL;
    const relayKey = process.env.MAIL_RELAY_KEY;

    // Derive a short plaintext summary to include in the email body.
    const reportRes = await fetch(new URL(`/api/reports/user/${encodeURIComponent(userId)}?receipt=1`, new URL(req.url).origin), {
      headers: { Authorization: req.headers.get("authorization") ?? "" },
    });
    const report = await reportRes.json().catch(() => null);
    if (!report?.ok) return fail(500, "Could not compose the report.");
    const identity = report.identity;
    const kpis = report.kpis;
    const receipt = report.receipt;

    if (!relayUrl) {
      // Deterministic, non-crashing placeholder so the UI can surface intent.
      return fail(503, "Email relay not configured. Set MAIL_RELAY_URL (+ MAIL_RELAY_KEY) to enable dispatch.", {
        summary: `Queued manually: ${identity.email}`, receiptNumber: receipt?.number,
      });
    }

    const subject = `Your VORTEX GAMING activity audit ${receipt?.number ?? ""}`;
    const pdf = await buildPdf(report);
    const filename = `vortex_activity_report_${String(userId).slice(0, 8)}.pdf`;
    const text = [
      `Player: ${identity.username} <${identity.email}>`,
      `Receipt: ${receipt?.number} (verify ${receipt?.verifyUrl})`,
      `Generated: ${receipt?.generatedAtIST ?? formatToIST(new Date())}`,
      `Games played: ${kpis.gamesPlayed} · Win rate: ${kpis.winRatePct}% · High score: ${kpis.highScore}`,
      `Total play time: ${kpis.totalPlaySeconds}s`,
    ].join("\n");

    const send = await fetch(relayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(relayKey ? { Authorization: `Bearer ${relayKey}` } : {}),
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: identity.email, name: identity.username }] }],
        from: { email: process.env.MAIL_FROM ?? "reports@vortex.gg", name: "VORTEX GAMING" },
        subject,
        content: [{ type: "text/plain", value: text }],
        attachments: [{
          content: pdf.toString("base64"),
          filename,
          type: "application/pdf",
          disposition: "attachment",
        }],
      }),
    });

    if (!send.ok) {
      const detail = await send.text().catch(() => "");
      console.error("[api/reports/email] relay rejected:", send.status, detail.slice(0, 300));
      return fail(502, "The SMTP relay rejected the message.");
    }

    return ok({ ok: true, queued: true, to: identity.email, receiptNumber: receipt?.number });
  } catch (err) {
    console.error("[api/reports/email]", err);
    return fail(500, "Could not dispatch the email.");
  }
}
