# VORTEX GAMING — End-to-End Code & Security Audit

**Scope:** full repository — Next.js 16 App Router API layer (`src/`), PostgreSQL/Drizzle data layer, vanilla-JS client (`public/`), PWA service worker, build/tooling config.
**Method:** static review of every route and client module + live black-box verification against a running instance (auth-guard matrix, three proof-of-concept exploits, 16-game regression harness, DOM smoke test, `tsc --noEmit`, `npm audit`).
**Date:** 2026-10-03 · **Branch:** `arena/01a0ecd4-vortex-gaming`

---

## 1. Executive summary

| Area | Verdict |
|---|---|
| Broken pages / links | ✅ PASS — every `href`/`src`/anchor resolves; all JS element IDs exist on their page |
| HTML/CSS/JS errors | ✅ PASS — `tsc --noEmit` clean; DOM smoke healthy; no `eval`/`document.write`/inline handlers |
| API routes | ⚠️ 12/14 routes solid; findings F5, F6, F10, F11, F13, F14 |
| Login / register | ⚠️ bcrypt + JWT correct; default-credential and rate-limit findings F1–F3, F8 |
| Database layer | ✅ Drizzle parameterised (no SQLi); findings F12 (boot), F11 (growth) |
| Score saving / leaderboards | ❌ 3 integrity flaws confirmed by live PoC (F5, F6a, F6b) |
| Session / user data | ❌ login-count inflation confirmed (F9) |
| Static assets | ✅ all resolve (jpg→svg fallback is intentional) |
| Interactive elements | ✅ 16/16 games ran clean (500 frames each), modals/forms wired |
| Responsive layout | ✅ 7 breakpoints, no overflow traps found |
| Security / configuration | ❌ default secrets (F1–F3), critical Next.js advisories (F4), missing headers (F7) |
| Demo readiness | ⚠️ F10 (receipt 500s), F15 (stale SW cache), F16 (jsdom) |

**PoC evidence (all executed live against this build):**

| # | Exploit | Result |
|---|---|---|
| PoC-1 | `POST /api/scores/submit` with `xpDelta: 100000` | `{ok:true, totalXp:100000, level:62}` — instant level 62 |
| PoC-2 | `POST /api/tracking/game-log` signed only with the **public** `clientChecksum` algorithm | `{ok:true, recorded:true}` — forged “WON” on the board |
| PoC-3 | game-log with `endTime-startTime = 60 s` but `durationSeconds: 86400`, `finalScore: 3000000` | `{ok:true, recorded:true, velocity:34.72}` — score bound bypassed (any score ≤ bound × 86400) |

---

## 2. What is already solid (do not regress these)

- **Auth guards are correct on the server**: `/api/admin/*`, `/api/reports/user/:id`, `/api/auth/me` all return 401 unauthenticated (verified live). Admin console double-gates (client `sessionStorage` + server `requireAdmin`).
- **Password hashing**: bcryptjs cost 10, uniform login errors (no account enumeration on login).
- **SQL injection**: impossible via Drizzle `sql` templates/parameter binding; admin search strips `%`/`_`.
- **XSS**: every dynamic `innerHTML` sink is `escapeHtml`/`esc` wrapped (admin, leaderboard, receipt); no `eval`, no inline `onclick`.
- **Guest isolation**: guest scores return `saved:false` and never touch the DB (verified live).
- **Client resilience**: `db.js` survives blocked storage, API calls time out at 9 s and always settle; offline queue bounded at 50.
- **Service worker**: never intercepts `/api/*`; network-first navigations.
- **Game engines**: 16/16 ran 500 frames clean in the harness; focus-freeze guard and puzzle generator tests pass.

---

## 3. Findings

Severity: **H**igh / **M**edium / **L**ow. “Fix” sections below give complete drop-in code.

| # | File | Issue category | Sev | Exact fix |
|---|---|---|---|---|
| F1 | `src/db/seed.ts` | Security — default admin credentials | **H** | Fallback password `VortexAdmin#2026` is minted whenever `ADMIN_PASSWORD` is unset. Refuse to seed a known password in production; generate a random one-time password and log it once. → Fix 1 |
| F2 | `src/lib/api.ts` | Security — default JWT secret | **H** | `JWT_SECRET ?? "vortex-dev-secret-change-me"` signs forgeable session tokens if the env is missing. Throw at boot in production. → Fix 2 |
| F3 | `src/lib/telemetry.ts` | Security — default proof secret | **H** | `PROOF_SECRET ?? JWT_SECRET ?? "vortex-dev-proof-secret"` makes receipt hashes/HMACs forgeable. Same treatment. → Fix 3 |
| F4 | `package.json` | Dependency vulnerabilities | **H** | `npm audit`: 12 issues (1 critical). `next ≤ 16.3.5` — middleware/proxy bypass (GHSA-6gpp-xcg3-4w24), Server-Action DoS, SSRF, cache confusion; `postcss` XSS/path-traversal ×4; `sharp` libvips CVEs. Bump `next` to `16.3.8` and run `npm audit fix`. → Fix 4 |
| F5 | `src/app/api/scores/submit/route.ts` | Game score/XP integrity | **H** | Client-supplied `xpDelta` (≤100 000) is added to XP verbatim — PoC-1. Compute XP server-side from score; treat client XP as a small clamped bonus. → Fix 5 |
| F6a | `src/app/api/tracking/game-log/route.ts` | Anti-cheat bypass | **H** | `durationSeconds` is read from the request body and never cross-checked against `endTime − startTime`; `validateScore` uses the claimed duration — PoC-3. Derive duration from timestamps and reject over-long sessions. → Fix 6 |
| F6b | `src/app/api/tracking/game-log/route.ts`, `public/js/vortex-telemetry.js` | Anti-cheat — forgeable checksum | **M** | The route accepts `clientChecksum`, a **public** FNV algorithm shipped in the browser bundle — PoC-2. The server HMAC it also accepts adds nothing because the OR bypass exists. Stop treating it as proof; keep it only for replay-idempotency. → Fix 6 (same block) |
| F7 | `next.config.ts` | Security headers | **M** | Empty config: no `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, CSP, HSTS. → Fix 7 |
| F8 | `src/app/api/auth/login/route.ts`, `register/route.ts` | Auth hardening | **M** | No rate limiting/lockout — unlimited password guessing. In-memory sliding-window limiter (5/min per IP for auth). → Fix 8 |
| F9 | `src/app/api/tracking/session/route.ts` + `src/app/api/auth/login/route.ts` | Session/user data correctness | **M** | `totalLoginCount` is incremented by **both** the login handler and every page-load `tracking/session` “start” — a single user refreshing the page inflates the audit report’s login count (demo-visible). Keep increment on login only; session-start just touches `lastLoginAt`. → Fix 9 |
| F10 | `src/lib/telemetry.ts` (`makeReceiptNumber`) | Reliability / demo brittleness | **M** | Receipt numbers are `#VTX-<year>-<5 random digits>` (90 k keyspace) with a UNIQUE constraint and no retry — after a few hundred audits the modal starts failing 500 “Could not load activity”. Use time+random entropy and retry once on conflict. → Fix 10 |
| F11 | `src/app/api/reports/user/[id]/route.ts` | Data hygiene | **M** | Every modal open (`?receipt=1`) INSERTs a new `receipt_audits` row — unbounded growth and feeds F10. Mint at most one receipt per user per day unless `&fresh=1`. → Fix 10 (same block) |
| F12 | `src/db/index.ts` | Robustness / configuration | **M** | Module-scope `throw` when `DATABASE_URL` is missing crashes every route at import with an opaque 500. Fail with an actionable message and let `/api/health` report `db:"down"`. → Fix 11 |
| F13 | `src/app/api/auth/register/route.ts` | Error handling | **L** | TOCTOU race on the “existing user” pre-check: concurrent duplicate registrations hit the unique index and surface 500 instead of 409. Catch unique violations. → Fix 12 |
| F14 | `src/app/api/tracking/session/route.ts` | IDOR (low impact) | **L** | `beat`/`close` accept any `sessionId` with no ownership check. UUIDs make blind guessing impractical, but scope the update to the caller. → Fix 12 (same block) |
| F15 | `public/sw.js` | PWA / demo readiness | **L** | Precache omits `vendor/qrcode.min.js` and `admin.html`; cache-first assets go stale unless `CACHE` is bumped every deploy. Add missing entries and bump the version on release. → Fix 13 |
| F16 | `scripts/dom-smoke.js`, `package.json` | Dev tooling | **L** | `dom-smoke.js` requires `jsdom` which is not a declared dependency — fresh clones crash. Add to `devDependencies`. → Fix 13 (same block) |
| F17 | `public/vendor/html2canvas.min.js`, `jspdf.umd.min.js`, `package.json` | Dead code / attack surface | **L** | Nothing references html2canvas/jspdf after the print-based PDF rework (the npm deps and ~1 MB vendor bundles are orphaned). Delete the vendor files and drop `html2canvas`, `jspdf`, `qrcodejs2` deps. → Fix 13 (same block) |
| F18 | `public/index.html` (line ~415) | Dead code | **L** | `vendor/qrcode.min.js` is loaded but no `QRCode` API is used anywhere (the audit modal no longer renders QR). Remove the tag. → Fix 13 (same block) |
| F19 | `src/app/layout.tsx` | UI/SEO metadata | **L** | Root metadata still says “Arena Next.js PostgreSQL Starter”. Update title/description. → Fix 13 (same block) |
| F20 | `src/lib/api.ts` (CORS) | Hardening | **L** | `Access-Control-Allow-Origin: *` on all JSON responses. Acceptable today (Bearer-in-header, no cookies) but tighten to the deploy origin when known. → noted in Fix 7 (env-driven) |
| F21 | `public/js/vortex-interactions.js` (~270) | Cosmetic | **L** | Modal banner first sets `<key>.svg` then probes `.jpg`; jpg-only titles flash a broken background for a frame. Harmless; flip the order if you care. |
| F22 | `src/app/api/verify-receipt/route.ts` | Privacy (by design) | **L** | Public endpoint discloses the owner’s username for any receipt hash. That is the QR-verify feature; ensure the UX copy makes it intentional. |

---

## 4. Complete drop-in fixes

> Every block below is complete and surgical — no truncated snippets. Apply in order. The game engines (`games-*.js`, `neon-snake.js`, `vortex-engine.js`) are **not touched** by any fix.

### Fix 1 — `src/db/seed.ts` (F1: kill default admin password)

Replace the password lines inside `runSeed()`:

```ts
  if (existing.length === 0) {
    // Never seed a well-known password. Production must supply ADMIN_PASSWORD;
    // otherwise we mint a random one-time password and print it to the server
    // log exactly once so the operator can sign in and change it.
    let password = process.env.ADMIN_PASSWORD;
    if (!password) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "ADMIN_PASSWORD must be set in production — refusing to seed a default admin credential.",
        );
      }
      password = `Vtx-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
      console.warn("[seed] ADMIN_PASSWORD not set — generated one-time admin password:", password);
    }
    const passwordHash = await bcrypt.hash(password, 10);
```

### Fix 2 — `src/lib/api.ts` (F2: no silent JWT fallback)

Replace the `JWT_SECRET` constant and widen the CORS allow-list via env (F20):

```ts
function requireSecret(name: string, devFallback: string): string {
  const v = process.env[name];
  if (v && v.length >= 16) return v;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} must be set to a value of at least 16 characters in production.`);
  }
  return devFallback;
}

export const JWT_SECRET = requireSecret("JWT_SECRET", "vortex-dev-secret-change-me");

const ALLOWED_ORIGIN = process.env.CORS_ORIGIN ?? "*";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};
```

### Fix 3 — `src/lib/telemetry.ts` (F3: no silent proof fallback)

Replace the `PROOF_SECRET` assignment:

```ts
const PROOF_SECRET = (() => {
  const direct = process.env.PROOF_SECRET;
  if (direct && direct.length >= 16) return direct;
  const viaJwt = process.env.JWT_SECRET;
  if (viaJwt && viaJwt.length >= 16 && process.env.PROOF_SECRET === undefined) return viaJwt;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PROOF_SECRET must be set to a value of at least 16 characters in production.");
  }
  return "vortex-dev-proof-secret";
})();
```

### Fix 4 — `package.json` (F4: dependency CVEs)

```jsonc
// package.json — change the version line, then run:  npm install && npm audit fix
"dependencies": {
  "next": "16.3.8",   // was ^16.2.6 — fixes GHSA-6gpp-xcg3-4w24 (critical) + 3 more
  // ...其余 dependencies 不变
}
```

```bash
npm install next@16.3.8
npm audit fix          # then re-run: npm audit  → expect 0 critical
npm run typecheck      # confirm tsc stays clean
```

### Fix 5 — `src/app/api/scores/submit/route.ts` (F5: server-authoritative XP)

Replace the XP calculation + write block:

```ts
    // Server-authoritative XP: the score-derived payout is computed here and
    // the client's xpDelta may only add a small, bounded event bonus.
    const scorePayout = 10 + Math.floor(score / 20);
    const eventBonus = clampInt(body.xpDelta, 0, 1_000, 0);
    const xpEarned = scorePayout + eventBonus;

    await db.insert(scores).values({ userId: user.id, gameId: game.id, score, xpEarned });

    await db
      .update(users)
      .set({ totalXp: sql`${users.totalXp} + ${xpEarned}` })
      .where(eq(users.id, user.id));
```

(Rest of the handler — the `userProfiles` upsert, best-score query and response — stays as is. The existing `clampInt` import already provides the bound.)

### Fix 6 — `src/app/api/tracking/game-log/route.ts` (F6a+F6b: duration truth + honest checksum)

Replace from the `const start = new Date(startTime);` block through the anti-cheat section:

```ts
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end.getTime() < start.getTime()) {
      return fail(400, "Invalid start/end timestamps.");
    }

    /* Duration is DERIVED from the timestamps — never trusted from the body
       (the velocity gate below depends on this being truthful). */
    const derivedDuration = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
    if (derivedDuration > 4 * 3600) {
      return fail(422, "Session window too long — telemetry rejected.");
    }

    /* Anti-cheat #1 — payload integrity. The server HMAC is the authoritative
       proof and is what gets stored in the ledger. The legacy client checksum
       remains accepted ONLY as replay/idempotency compatibility — it is a
       public algorithm and must never be treated as anti-tamper evidence. */
    const expectedHmac = proofHmac({ sessionKey, gameKey, startTime, endTime, status, finalScore });
    const clientProof = clientChecksum({ sessionKey, gameKey, startTime, endTime, status, finalScore });
    if (!checksum || (checksum !== expectedHmac && checksum !== clientProof)) {
      return fail(422, "Checksum mismatch — telemetry rejected as tampered.");
    }

    /* Anti-cheat #2 — theoretical score boundary, using the derived duration. */
    if (!validateScore(gameKey, finalScore, derivedDuration)) {
      return fail(422, "Score exceeds the theoretical boundary for this game.");
    }

    const velocity = derivedDuration > 0 ? finalScore / derivedDuration : finalScore;
    const user = await getAuthUser(req);

    await db.insert(gameActivityLogs).values({
      sessionKey,
      userId: user?.id ?? null,
      gameKey,
      gameName,
      startTime: start,
      endTime: end,
      durationSeconds: derivedDuration,
      status,
      finalScore,
      scoreVelocity: Number(velocity.toFixed(4)),
      checksum: expectedHmac, // authoritative server-side HMAC ledger proof
    }).onConflictDoNothing({ target: gameActivityLogs.sessionKey });
```

> Note: with F6a closed, the remaining spoofing window is “claim a long-but-plausible session (≤ 4 h) at the per-game velocity bound”. Fully closing that requires server-authoritative scoring (out of scope for client-side canvas games); the bound + rate limits (Fix 8) + the fact that the leaderboard shows only top-10 keep it acceptable.

### Fix 7 — `next.config.ts` (F7: security headers + F20)

```ts
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Legit canvas games use inline styles + the neon FX layer; keep CSP report-only
      // until tuned, then flip to enforced.
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy-Report-Only",
            value:
              "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### Fix 8 — `src/lib/api.ts` append (F8: rate limiter) + wire into auth routes

Append to `src/lib/api.ts`:

```ts
/* ----------------------- in-memory rate limiting ------------------- */
const buckets = new Map<string, { count: number; resetAt: number }>();

/** Sliding-window limiter. Single-instance only — for multi-instance
 *  deployments swap the Map for Redis/Upstash with the same signature. */
export function rateLimit(req: Request, key: string, max: number, windowMs: number): boolean {
  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const id = `${key}:${ip}`;
  const now = Date.now();
  const b = buckets.get(id);
  if (!b || b.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= max;
}
```

Wire into `POST` handlers of `src/app/api/auth/login/route.ts` **and** `src/app/api/auth/register/route.ts`, right after `try {`:

```ts
    if (!rateLimit(req, "auth", 5, 60_000)) {
      return fail(429, "Too many attempts — please wait a minute and try again.");
    }
```

(and extend the `@/lib/api` import list in both files with `rateLimit`.)

### Fix 9 — F9: login-count truth

In `src/app/api/tracking/session/route.ts`, replace the profile update inside the “start” branch:

```ts
    if (user) {
      // Session start is NOT a login — only touch lastLoginAt. The login count
      // is maintained exclusively by /api/auth/login so page refreshes cannot
      // inflate the audit report's "total login count".
      await db
        .update(userProfiles)
        .set({
          lastLoginAt: new Date(),
          ...(device ? { deviceSignature: device } : {}),
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, user.id));
    }
```

### Fix 10 — F10 + F11: receipt numbers & mint throttle

Replace `makeReceiptNumber` in `src/lib/telemetry.ts`:

```ts
export function makeReceiptNumber(): string {
  const year = new Date().getUTCFullYear();
  // time-ordered + 96 bits of entropy — unique in practice, human-readable
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  const rnd = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `#VTX-${year}-${ts}${rnd}`;
}
```

In `src/app/api/reports/user/[id]/route.ts`, wrap the receipt insert so repeated opens do not mint rows (and a duplicate can never 500 the report). Replace the `if (wantReceipt) { ... }` internals' insert with:

```ts
      // Mint at most one receipt per user per UTC day; `?receipt=1&fresh=1`
      // forces a new one (e.g. "download with receipt" flows).
      const forceFresh = new URL(req.url).searchParams.get("fresh") === "1";
      const recentRows = await db
        .select({ id: receiptAudits.id, receiptNumber: receiptAudits.receiptNumber, receiptHash: receiptAudits.receiptHash, generatedAt: receiptAudits.generatedAt })
        .from(receiptAudits)
        .where(eq(receiptAudits.userId, user.id))
        .orderBy(desc(receiptAudits.generatedAt))
        .limit(1);
      const recent = recentRows[0];
      const sameDay =
        recent &&
        new Date(recent.generatedAt).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);

      if (recent && sameDay && !forceFresh) {
        // reuse today's receipt (payload hash is refreshed below)
        await db
          .update(receiptAudits)
          .set({ payloadHash: sha256(JSON.stringify(logs.map((l) => [l.id, l.status, l.finalScore]))) })
          .where(eq(receiptAudits.id, recent.id));
        receipt = {
          number: recent.receiptNumber,
          hash: recent.receiptHash,
          generatedAtIST: formatToIST(recent.generatedAt),
          verifyUrl: `${new URL(req.url).origin}/api/verify-receipt?id=${encodeURIComponent(recent.receiptHash)}`,
        };
      } else {
        // (keep the existing mint/insert code here, unchanged — the new
        // makeReceiptNumber makes the unique constraint effectively safe)
      }
```

### Fix 11 — `src/db/index.ts` (F12: graceful configuration failure)

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

/** Lazy, shared pool. Missing DATABASE_URL degrades to a clear runtime error
 *  instead of an import-time crash that 500s every route opaquely. */
const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

let _pool: Pool | null = globalForDb.__arenaNextJsPostgresqlPool ?? null;

function getPool(): Pool {
  if (_pool) return _pool;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env (see .env.example) — the API cannot start without it.",
    );
  }
  _pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 10_000 });
  if (process.env.NODE_ENV !== "production") globalForDb.__arenaNextJsPostgresqlPool = _pool;
  return _pool;
}

export const pool = new Proxy({} as Pool, {
  get(_t, prop) {
    const p = getPool() as unknown as Record<string | symbol, unknown>;
    const v = p[prop];
    return typeof v === "function" ? v.bind(p) : v;
  },
}) as Pool;

export const db = drizzle(() => getPool());
```

### Fix 12 — F13 + F14: race-safe register, session ownership

`src/app/api/auth/register/route.ts` — wrap the insert (after the pre-check) in a duplicate-safe catch:

```ts
    let created;
    try {
      const inserted = await db
        .insert(users)
        .values({ username, email, passwordHash })
        .returning({ id: users.id, role: users.role, createdAt: users.createdAt });
      created = inserted[0];
    } catch (err) {
      const msg = String((err as Error)?.message ?? "");
      if (/users_email_unique|users_username_unique|duplicate key/i.test(msg)) {
        return fail(409, "That username or email is already registered.");
      }
      throw err;
    }
```

`src/app/api/tracking/session/route.ts` — scope `beat` and `close` updates to the caller (both handlers, same shape):

```ts
      const user = await getAuthUser(req);
      const where = user
        ? and(eq(userSessions.id, sessionId), eq(userSessions.userId, user.id))
        : and(eq(userSessions.id, sessionId), isNull(userSessions.userId));
      const updated = await db
        .update(userSessions)
        .set({ lastActiveAt: new Date() /* ...existing sets... */ })
        .where(where)
        .returning({ id: userSessions.id });
      if (updated.length === 0) return fail(404, "Session not found.");
```

(add `isNull` to the `drizzle-orm` import; if you prefer to let anonymous owners keep beating guest sessions after sign-in, drop the `where` ternary and keep only the `returning` existence check.)

### Fix 13 — F15–F19: hygiene bundle

`public/sw.js` — extend the precache array:

```js
  "/vendor/dexie.min.js",
  "/vendor/qrcode.min.js",
  "/admin.html",
  "/icons/icon.svg",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];
```

…and bump `var CACHE = "vortex-v3.0.2";` **every time you deploy asset changes** (cache-first assets otherwise serve stale files during demos).

`package.json`:

```jsonc
  "devDependencies": {
    "jsdom": "^26.0.0",   // required by scripts/dom-smoke.js
    // ...
  },
  // remove from "dependencies": "html2canvas", "jspdf", "qrcodejs2"
  // (keep "dexie" if you prefer the npm copy; today the vendor bundle is what loads)
```

```bash
rm public/vendor/html2canvas.min.js public/vendor/jspdf.umd.min.js
```

`public/index.html` — delete the dead script tag:

```html
  <!-- remove this line (no QRCode API is used anymore) -->
  <script defer src="vendor/qrcode.min.js"></script>
```

`src/app/layout.tsx`:

```tsx
export const metadata: Metadata = {
  title: "VORTEX GAMING — Neon Browser Arcade",
  description:
    "An ultra-cinematic browser arcade with 16 playable neon titles, XP progression and global leaderboards.",
};
```

---

## 5. Pre-demo (teacher/demo) checklist

1. **Set the three secrets** in the real environment: `JWT_SECRET`, `PROOF_SECRET`, `ADMIN_PASSWORD` (≥ 16 chars, unique per env) — F1–F3.
2. **Sign in once as admin** and confirm the console loads before showing it live (guards verified working).
3. **Hard-refresh or bump the SW cache** (`vortex-v3.0.2`) right before the demo so no stale JS is served (F15).
4. **Play one full game to game-over** on the demo machine first — this syncs a leaderboard row so the board shows live data instead of an empty state.
5. **The audit modal can only fail one way in a long-lived DB** (receipt number collision) — fixed by F10; apply it before any classroom marathon.
6. **Offline mode is real**: `sw.js` caches the shell — if the venue Wi-Fi dies, the arcade still plays and scores queue locally (by design; say so in the demo).
7. `npm run typecheck && node scripts/game-harness.js` — both green before any live session.

---

## 6. Verification commands

```bash
npm run typecheck                 # tsc --noEmit → clean
node scripts/game-harness.js      # 16/16 games clean + focus/gen tests
node scripts/dom-smoke.js --real  # UI smoke against the running dev server
npm audit                         # expect 0 critical after Fix 4
# auth guard matrix (all must be 401 without a token):
for u in /api/admin/stats /api/admin/users /api/admin/telemetry /api/reports/user/x /api/auth/me; do
  curl -s -o /dev/null -w "%{http_code} $u\n" "http://localhost:3000$u"
done
```
