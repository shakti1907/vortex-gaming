import PDFDocument from "pdfkit";
import { db } from "@/db";
import { gameActivityLogs, receiptAudits, users, userProfiles } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { preflight, getAuthUser, fail } from "@/lib/api";
import { ensureSeed, levelFromXp } from "@/db/seed";
import {
  formatToIST,
  makeReceiptNumber,
  makeReceiptHash,
  sha256,
} from "@/lib/telemetry";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/* ------------------------------------------------------------------ */
/* GET /api/reports/user/:id/pdf — vector PDF of the activity audit.   */
/* Owner-or-admin only. Same data contract as the JSON report route;   */
/* this route ONLY ADDS a binary download (never alters the JSON API). */
/* Query: ?theme=dark|light  (default: dark — neon HUD)                */
/*        ?fresh=1          (force-mint a new receipt row)             */
/* ------------------------------------------------------------------ */

type LogRow = {
  id: string;
  gameKey: string;
  gameName: string;
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
  status: string;
  finalScore: number;
};

function fmtDur(sec: number): string {
  const s = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${r}s` : `${r}s`;
}

/** Tier band derived from level — mirrors the client HUD progression. */
function tierFor(level: number): { tier: string; grade: string } {
  if (level >= 60) return { tier: "NEON LEGEND", grade: "S+" };
  if (level >= 45) return { tier: "DIAMOND", grade: "S" };
  if (level >= 30) return { tier: "PLATINUM", grade: "A" };
  if (level >= 20) return { tier: "GOLD", grade: "B" };
  if (level >= 10) return { tier: "SILVER", grade: "C" };
  if (level >= 5) return { tier: "BRONZE", grade: "D" };
  return { tier: "ROOKIE", grade: "E" };
}

/** Telemetry health: 25 pts per healthy data pillar (0-100). */
function healthScore(p: { identity: boolean; activity: boolean; kpis: boolean; receipt: boolean }): number {
  const pillars = [p.identity, p.activity, p.kpis, p.receipt];
  return pillars.filter(Boolean).length * 25;
}

const THEMES = {
  dark: {
    bg: "#0b0621",
    panel: "#150b34",
    panelAlt: "#1d1046",
    text: "#f4efff",
    dim: "#a99ec9",
    primary: "#ff2e88",
    secondary: "#2ee6ff",
    accent: "#ffb42e",
    line: "rgba(255, 46, 136, 0.35)",
  },
  light: {
    bg: "#ffffff",
    panel: "#f3f1f8",
    panelAlt: "#e9e5f4",
    text: "#14101f",
    dim: "#55506b",
    primary: "#b3004d",
    secondary: "#0066aa",
    accent: "#8a5a00",
    line: "rgba(20, 16, 31, 0.28)",
  },
} as const;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const auth = await getAuthUser(req);
    if (!auth || (auth.id !== id && auth.role !== "admin")) {
      return fail(401, "You may only download your own report.");
    }
    await ensureSeed();

    const url = new URL(req.url);
    const themeKey = url.searchParams.get("theme") === "light" ? "light" : "dark";
    const T = THEMES[themeKey];
    const forceFresh = url.searchParams.get("fresh") === "1";

    const userRows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const u = userRows[0];
    if (!u) return fail(404, "User not found.");
    const profileRows = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, id))
      .limit(1);
    const p = profileRows[0];

    const logs = (await db
      .select()
      .from(gameActivityLogs)
      .where(eq(gameActivityLogs.userId, id))
      .orderBy(desc(gameActivityLogs.createdAt))
      .limit(60)) as LogRow[];

    /* ---- KPIs (same aggregation as the JSON report route) ---- */
    let wins = 0, losses = 0, quits = 0, totalTime = 0, highScore = 0, totalScore = 0, longest = 0;
    for (const l of logs) {
      totalTime += l.durationSeconds;
      totalScore += l.finalScore;
      highScore = Math.max(highScore, l.finalScore);
      longest = Math.max(longest, l.durationSeconds);
      if (l.status === "WON") wins++;
      else if (l.status === "LOST") losses++;
      else quits++;
    }
    const gamesPlayed = logs.length;
    const winRatePct = gamesPlayed ? Math.round((wins / gamesPlayed) * 100) : 0;
    const level = levelFromXp(u.totalXp);
    const { tier, grade } = tierFor(level);

    /* ---- receipt: reuse the latest ledger row (the JSON modal just minted
       one) so the printed hash matches the on-screen signature; mint only
       when the ledger is empty or ?fresh=1. ---- */
    let receiptNumber = "";
    let receiptHash = "";
    const latest = await db
      .select({
        receiptNumber: receiptAudits.receiptNumber,
        receiptHash: receiptAudits.receiptHash,
      })
      .from(receiptAudits)
      .where(eq(receiptAudits.userId, id))
      .orderBy(desc(receiptAudits.generatedAt))
      .limit(1);

    if (latest[0] && !forceFresh) {
      receiptNumber = latest[0].receiptNumber;
      receiptHash = latest[0].receiptHash;
    } else {
      const generatedAt = new Date();
      receiptNumber = makeReceiptNumber();
      receiptHash = makeReceiptHash(id, receiptNumber, generatedAt.toISOString());
      await db
        .insert(receiptAudits)
        .values({
          userId: id,
          receiptNumber,
          receiptHash,
          payloadHash: sha256(
            JSON.stringify({ id, gamesPlayed, wins, losses, highScore, totalTime, cnt: logs.length }),
          ),
        })
        .onConflictDoNothing();
    }

    const generatedAtIST = formatToIST(new Date());
    const verifyUrl = `${url.protocol}//${url.host}/api/verify-receipt?id=${receiptHash}`;
    const health = healthScore({
      identity: true,
      activity: logs.length > 0,
      kpis: gamesPlayed > 0,
      receipt: !!receiptHash,
    });

    /* ================================================================ */
    /* VECTOR PDF — neon HUD report (header · metrics · table · footer)  */
    /* ================================================================ */
    const doc = new PDFDocument({
      size: "A4",
      margin: 42,
      bufferPages: true,
      info: {
        Title: "VORTEX GAMING · OFFICIAL ACTIVITY AUDIT",
        Author: "VORTEX GAMING",
        Subject: `Activity audit for ${u.username}`,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    const W = doc.page.width - 84; // printable width at 42pt margins
    const pageH = doc.page.height;

    /* ---- page background (dark themes need a painted canvas) ---- */
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(T.bg);

    /* ---- HEADER: vector brand mark + title + identity + badge ---- */
    // brand mark: concentric vector circles + crosshairs (matches site logo)
    doc.save();
    doc.lineWidth(3).strokeColor(T.primary).circle(62, 62, 15).stroke();
    doc.lineWidth(2).strokeColor(T.secondary).circle(62, 62, 6.5).stroke();
    doc.lineWidth(2.4).strokeColor(T.primary);
    doc.moveTo(62, 47).lineTo(62, 54).stroke();
    doc.moveTo(62, 70).lineTo(62, 77).stroke();
    doc.moveTo(47, 62).lineTo(54, 62).stroke();
    doc.moveTo(70, 62).lineTo(77, 62).stroke();
    doc.restore();

    doc.font("Helvetica-Bold").fontSize(16).fillColor(T.text);
    doc.text("VORTEX GAMING", 92, 46);
    doc.font("Helvetica").fontSize(9).fillColor(T.secondary);
    doc.text("OFFICIAL ACTIVITY AUDIT  ·  CONFIDENTIAL", 92, 68, { characterSpacing: 1.2 });

    // status badge (top-right)
    const badge = `${u.status.toUpperCase()}  ·  ${u.role.toUpperCase()}  ·  ${tier} ${grade}`;
    doc.roundedRect(360, 46, 195, 22, 11).fill(T.primary);
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor(themeKey === "dark" ? "#12071f" : "#ffffff");
    doc.text(badge, 365, 53, { width: 185, align: "center", characterSpacing: 0.8 });

    // identity strip
    doc.font("Courier-Bold").fontSize(8).fillColor(T.dim);
    doc.text(`USER  ${u.username}`, 42, 96, { continued: true, characterSpacing: 0.5 });
    doc.fillColor(T.dim).text(`     ID  ${u.id}`, { characterSpacing: 0.5 });
    doc.font("Courier").fontSize(7.5).fillColor(T.dim);
    doc.text(
      `GENERATED ${generatedAtIST}     ·     REGISTERED ${formatToIST(u.createdAt)}     ·     LOGINS ${p?.totalLoginCount ?? 1}`,
      42, 110,
    );
    doc.moveTo(42, 126).lineTo(42 + W, 126).lineWidth(1.5).strokeColor(T.primary).stroke();
    doc.moveTo(42, 129.5).lineTo(42 + W, 129.5).lineWidth(0.6).strokeColor(T.secondary).stroke();

    /* ---- SUMMARY METRICS GRID — 2 rows x 3 cards ---- */
    const cards: { label: string; value: string; sub: string }[] = [
      { label: "SCORE TOTAL", value: totalScore.toLocaleString("en-IN"), sub: `BEST ${highScore.toLocaleString("en-IN")}` },
      { label: "GAMES PLAYED", value: String(gamesPlayed), sub: `${wins}W · ${losses}L · ${quits}Q` },
      { label: "WIN RATE", value: `${winRatePct}%`, sub: `STREAK READY` },
      { label: "PLAY TIME", value: fmtDur(totalTime), sub: `LONGEST ${fmtDur(longest)}` },
      { label: "TELEMETRY HEALTH", value: `${health}%`, sub: health >= 75 ? "NOMINAL" : "PARTIAL" },
      { label: "RANK / TIER", value: `${tier}`, sub: `LEVEL ${level} · GRADE ${grade}` },
    ];
    const gap = 10;
    const cardW = (W - gap * 2) / 3;
    const cardH = 58;
    let y = 146;
    for (let i = 0; i < cards.length; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 42 + col * (cardW + gap);
      const cy = y + row * (cardH + gap);
      doc.roundedRect(x, cy, cardW, cardH, 6).fill(i % 2 ? T.panelAlt : T.panel);
      doc.rect(x, cy, 3, cardH).fill(i % 3 === 1 ? T.secondary : T.primary);
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(T.dim).text(cards[i].label, x + 12, cy + 9, { characterSpacing: 1 });
      doc.font("Helvetica-Bold").fontSize(15).fillColor(T.text).text(cards[i].value, x + 12, cy + 21);
      doc.font("Helvetica").fontSize(7).fillColor(T.secondary).text(cards[i].sub, x + 12, cy + 43);
    }

    /* ---- PERFORMANCE BREAKDOWN TABLE ---- */
    y = 146 + 2 * (cardH + gap) + 18;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(T.primary).text("PERFORMANCE BREAKDOWN", 42, y, { characterSpacing: 1.4 });
    y += 16;

    const cols = [
      { key: "#", w: 22 },
      { key: "GAME KEY", w: 78 },
      { key: "GAME / MODULE", w: 118 },
      { key: "OUTCOME", w: 52 },
      { key: "HIGH SCORE", w: 62 },
      { key: "DURATION", w: 52 },
      { key: "START (IST)", w: 86 },
      { key: "END (IST)", w: 86 },
    ];
    const drawHeaderRow = (yy: number): number => {
      doc.rect(42, yy, W, 18).fill(T.panelAlt);
      let x = 42;
      for (const c of cols) {
        doc.font("Helvetica-Bold").fontSize(6).fillColor(T.secondary).text(c.key, x + 4, yy + 6, { width: c.w - 8, characterSpacing: 0.6 });
        x += c.w;
      }
      return yy + 18;
    };
    y = drawHeaderRow(y);

    if (logs.length === 0) {
      doc.font("Helvetica").fontSize(8).fillColor(T.dim).text("NO ACTIVITY RECORDED", 42, y + 8);
      y += 26;
    }
    for (let i = 0; i < logs.length; i++) {
      const l = logs[i];
      if (y + 18 > pageH - 70) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(T.bg);
        y = 42;
        y = drawHeaderRow(y);
      }
      const rowH = 17;
      if (i % 2 === 1) doc.rect(42, y, W, rowH).fill(T.panel);
      const cells = [
        String(i + 1),
        l.gameKey,
        l.gameName,
        l.status,
        l.finalScore.toLocaleString("en-IN"),
        fmtDur(l.durationSeconds),
        formatToIST(l.startTime),
        formatToIST(l.endTime),
      ];
      let x = 42;
      for (let c = 0; c < cols.length; c++) {
        const isOutcome = c === 3;
        doc
          .font(isOutcome ? "Helvetica-Bold" : "Helvetica")
          .fontSize(6.6)
          .fillColor(isOutcome ? (l.status === "WON" ? T.secondary : l.status === "LOST" ? T.primary : T.dim) : T.text)
          .text(cells[c], x + 4, y + 5.5, { width: cols[c].w - 8, ellipsis: true, lineBreak: false });
        x += cols[c].w;
      }
      doc.moveTo(42, y + rowH).lineTo(42 + W, y + rowH).lineWidth(0.4).strokeColor(T.line).stroke();
      y += rowH;
    }

    /* ---- FOOTER — page numbering + cryptographic signature ---- */
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const fy = pageH - 52;
      doc.moveTo(42, fy).lineTo(42 + W, fy).lineWidth(0.8).strokeColor(T.primary).stroke();
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(T.secondary);
      doc.text(`PAGE ${i - range.start + 1} OF ${range.count}`, 42, fy + 8, { characterSpacing: 1 });
      doc.font("Courier").fontSize(6).fillColor(T.dim);
      doc.text(`RECEIPT ${receiptNumber}`, 42, fy + 20, { lineBreak: false });
      doc.text(`SHA-256 ${receiptHash}`, 42, fy + 30, { width: 320, lineBreak: false });
      doc.text(`VERIFY  ${verifyUrl}`, 42, fy + 40, { width: 320, lineBreak: false });
      doc.font("Helvetica").fontSize(6.5).fillColor(T.dim);
      doc.text(`© ${new Date().getFullYear()} VORTEX GAMING · ALL TIMESTAMPS IST (ASIA/KOLKATA)`, 360, fy + 20, {
        width: 197,
        align: "right",
      });
    }

    doc.end();
    const pdf = await done;

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="vortex_activity_audit_${u.username}_${stamp}.pdf"`,
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    console.error("[api/reports/user/pdf]", err);
    return fail(500, "Could not render the PDF report.");
  }
}
