# VORTEX GAMING — Ultra-Cinematic Web Arcade

A production-ready, browser-native gaming hub: **16 fully playable titles**, a hardware-adaptive 120 FPS render core, generative Web Audio with a live analyser equalizer, XP progression, slot-machine discovery, and a JWT-secured PostgreSQL backend with a live Admin Console.

**100% vanilla front-end** (HTML5 + modern CSS3 + ES6 canvas JS) served as static assets, backed by a **Node.js REST API** (Next.js route handlers) + **PostgreSQL via Drizzle ORM** — zero native-app code, zero build-step for the arcade itself.

```
┌─────────────────────────────────────────────────────────────┐
│  BROWSER  (Chrome / Edge / Firefox / Safari)                │
│  ├─ index.html ...... arcade shell (16 games, canvas stage) │
│  ├─ admin.html ...... ops console (JWT gated)               │
│  ├─ css/vortex.css .. design system + 4 theme presets       │
│  └─ js/ ............ scanner, engine, 8 game engines, DB.io │
└──────────────┬──────────────────────────────────────────────┘
               │ fetch /api/* (JWT Bearer, JSON, CORS)
┌──────────────▼──────────────────────────────────────────────┐
│  NODE.JS API  (src/app/api/*)                                │
│  ├─ /api/auth/register · /api/auth/login · /api/auth/me     │
│  ├─ /api/scores/submit                                      │
│  ├─ /api/leaderboard/:gameKey                               │
│  ├─ /api/admin/stats · /api/admin/users  (admin only)       │
│  └─ /api/health                                             │
└──────────────┬──────────────────────────────────────────────┘
               │ Drizzle ORM (pg Pool)
┌──────────────▼──────────────────────────────────────────────┐
│  POSTGRESQL  (local or Supabase)                            │
│  users 1───N scores N───1 games · users 1───1 user_profiles │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Features

| Module | File | What it does |
|---|---|---|
| Shell | `public/index.html` | HTML5 overlay: hero, control deck, 4×4 game grid, modals, HUD rail |
| Styles | `public/css/vortex.css` | Design system, 4 theme presets, keyframes, perf-tier degradation |
| Scanner | `public/js/device-scanner.js` | 250ms canvas micro-benchmark → `perf-low / perf-medium / perf-high` |
| Stage | `public/js/vortex-engine.js` | Delta-time 120 FPS ambient stage, DPR scaling, themes, synth + equalizer |
| **FX core** | `public/js/vortex-fx.js` | **Shared game juice**: particle engine, hit sparks, motion trails, screen shake, floating combat text, additive neon draw helpers, HiDPI boot harness, unified input |
| Game 01 | `public/js/neon-snake.js` | Grid-locked Snake + dash boosts, plasma barriers, hazards, 3-tier food |
| Games 02-04 | `public/js/games-action.js` | Cyber Invaders · Asteroid Vector · Bullet Hell Rush |
| Games 05-08 | `public/js/games-puzzle.js` | Grid Stacker · Quantum Laser Reflect · Memory Matrix · Neon Flow |
| Games 09-12 | `public/js/games-retro.js` | Neon Pong 2.0 · Grid Pac-Runner · Cyber Soar · Retro Defender |
| Games 13-16 | `public/js/games-racing.js` | Outrun 2D Drive · Cyber Drift · Hyper Speed Dodge · Grid Dash |
| Interactions | `public/js/vortex-interactions.js` | Card renderer, 3D tilt physics, fuzzy search, launcher, leaderboard, auth |
| Gamification | `public/js/vortex-gamification.js` | `VortexGamification.addXP()`, level cinematics, card glows, Destiny Spin |
| Database | `schema.sql` + `src/db/schema.ts` | PostgreSQL schema: PKs, FKs, cascades, check constraints, indexes, seeds |
| REST API | `src/app/api/*` | JWT auth, bcrypt hashing, validation, CORS, error middleware |
| Admin | `public/admin.html` + `public/js/admin.js`, `public/js/db.js` | Admin console + hybrid local-first DB connector with background sync |
| Tests | `scripts/game-harness.js` | Headless canvas harness that boots and plays all 16 engines |

### Engine architecture

Every game is declared through one contract, so behaviour is consistent and leak-free:

```js
VortexFX.register({
  key: "cyber-drift", title: "Cyber Drift", hint: "...", pad: true,
  setup(api) {},                 // build state (api.data)
  update(dt, t, api) {},         // fixed-clamped delta time, never negative
  draw(ctx, t, api) {},          // additive neon rendering
  resize(api) {},                // HiDPI / layout re-flow
});
```

`api` provides `view` (HiDPI metrics), `fx` (particles/shake/popups), `input`
(WASD + arrows + `#dpad` + pointer, edge-detected), `hit()` (combo-multiplied
scoring with floating text), `xp()`, `gameOver()` and `win()`. The harness
cancels its `requestAnimationFrame` loop and removes **every** listener on
`destroy()`, so switching games never leaks.

### Verifying the games

```bash
node scripts/game-harness.js --smart --eat     # boot + play all 16 engines
```

It renders real frames against a stubbed canvas, drives keyboard/D-pad/pointer
input, drains virtual timers, and asserts two invariants: Neon Snake's
eat→grow→score→XP pipeline, and that 400/400 procedurally generated Quantum
Laser circuits are actually solvable.

---

## Enterprise telemetry (v3.0)

- **Silent lifecycle hooks:** the unchanged launcher emits `vortex:game:start`,
  `vortex:game:over`, and `vortex:game:quit`; `vortex-telemetry.js` listens in
  the background without touching rendering or controls.
- **Offline-first queue:** Dexie stores pending records in IndexedDB database
  `VortexOfflineDB`, object store `vortex_sync_queue`. The `online` listener
  flushes in order; PostgreSQL's unique `session_key` makes replay idempotent.
  localStorage under the exact key `vortex_sync_queue` is only a fallback when
  IndexedDB is blocked.
- **Focus guard:** `visibilitychange` pauses the shared game harness, elapsed
  clock, particle simulation, and score-velocity clock. Hidden sessions over
  three minutes are marked `TIMED_OUT`.
- **Admin guard:** `admin.js` validates the single
  `sessionStorage.vortex_admin_session` token against `/api/auth/me`. Logout
  clears it and returns to the lock screen.
- **Activity receipt:** authenticated users can open Play History, switch
  between Cyber Dark/Eco Print themes, scan a verifiable QR code, print, save
  PDF, or email a server-generated PDF through a configured relay.
- **UTC/IST:** PostgreSQL stores UTC timestamps; reports, receipts, peak-hour
  analytics, and CSV exports render `Asia/Kolkata` (IST).
- **PWA:** `manifest.json` and `sw.js` cache the full game suite plus local
  Dexie, QR, html2canvas, and jsPDF bundles for offline operation.

Optional email configuration:

```ini
MAIL_RELAY_URL=https://api.sendgrid.com/v3/mail/send
MAIL_RELAY_KEY=your-sendgrid-key
MAIL_FROM=reports@your-domain.example
PROOF_SECRET=independent-long-random-hmac-secret
```

Without a relay, the email endpoint returns a clear `503`; PDF download and
printing remain fully functional in the browser.

---

## 2. Prerequisites

- **Node.js 18.17+** (or 20+ recommended) — check with `node -v`
- **npm 9+**
- **PostgreSQL 14+** running locally *or* a free **Supabase** project

---

## 3. Step-by-Step — Local Laptop Setup

### Step 1 — Install dependencies

```bash
npm install
```

### Step 2 — Create a local PostgreSQL database

With local Postgres running (Homebrew/apt/Postgres.app/Docker):

```bash
# option A — if `psql` is on your PATH:
createdb app_db

# option B — via psql inside an existing server:
psql postgresql://postgres:postgres@127.0.0.1:5432/postgres -c "CREATE DATABASE app_db;"
```

Docker alternative (zero local install):

```bash
docker run --name vortex-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16
docker exec vortex-pg psql -U postgres -c "CREATE DATABASE app_db;"
```

### Step 3 — Configure environment variables

```bash
cp .env.example .env
```

Then edit `.env`:

```ini
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
JWT_SECRET=pick-a-long-random-string
ADMIN_PASSWORD=VortexAdmin#2026
```

> **Supabase instead?** Use your pooler URL from *Project Settings → Database → Connection string*:
> `DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

### Step 4 — Initialize the database schema

Pick **either** path — both create the identical structure + 16-game seed + admin account:

```bash
# option A — Drizzle (reads src/db/schema.ts):
npx drizzle-kit push

# option B — raw SQL script (also works inside the Supabase SQL editor):
psql postgresql://postgres:postgres@127.0.0.1:5432/app_db -f schema.sql
```

Verify:

```bash
psql postgresql://postgres:postgres@127.0.0.1:5432/app_db -c "SELECT count(*) FROM games;"
# → 16
```

### Step 5 — Start the Node.js server

```bash
# development (hot reload):
npm run dev

# production:
npm run build
npm start
```

### Step 6 — Open the arcade

| Surface | URL |
|---|---|
| Arcade (auto-redirects to the shell) | http://localhost:3000 |
| Direct shell | http://localhost:3000/index.html |
| **Admin Console** | http://localhost:3000/admin.html |
| Health probe | http://localhost:3000/api/health |

### Step 7 — Sign into the Admin Console

Seeded administrator (created automatically on first API call, or by `schema.sql`):

```
Email:    admin@vortex.gg
Password: VortexAdmin#2026      (or your ADMIN_PASSWORD value)
```

The console shows live metrics (total users, signups 24h/7d, active sessions, scores, global record), a 7-day signup chart, and a searchable/filterable/paginated user table.

---

## 4. REST API Reference

| Method | Endpoint | Auth | Body / Query | Responses |
|---|---|---|---|---|
| POST | `/api/auth/register` | — | `{username, email, password}` | 201 token · 400 validation · 409 conflict |
| POST | `/api/auth/login` | — | `{email, password}` | 200 token · 401 invalid · 403 banned |
| GET | `/api/auth/me` | Bearer | — | 200 user+profile · 401 |
| POST | `/api/scores/submit` | optional Bearer | `{gameKey, score, xpDelta}` | 200 saved · 200 guest/local · 400 |
| GET | `/api/leaderboard/:gameKey` | — | — | 200 top-10 · 404 |
| GET | `/api/admin/stats` | **admin** Bearer | — | 200 metrics · 401 |
| GET | `/api/admin/users` | **admin** Bearer | `?search=&status=&page=&limit=` | 200 paged rows · 401 |
| GET | `/api/health` | — | — | 200 `{ok:true}` |

All routes send permissive **CORS** headers and answer `OPTIONS` preflights. Guests play 100% offline-first: scores persist in `localStorage` and silently replay to Postgres once they sign in.

---

## 5. Controls Cheat-Sheet

| # | Game | Keyboard | Pointer / Touch | Signature mechanic |
|---|---|---|---|---|
| 01 | Neon Snake | Arrows / WASD · **Shift** dash | D-pad · ◆ dash | Dash leaves a lethal plasma barrier |
| 02 | Cyber Invaders | ← → · **Space** fire | Drag + hold to fire | Destructible shields, boss phases |
| 03 | Asteroid Vector | ← → rotate, ↑ thrust, **Q/E** swap | D-pad | True inertia + black-hole gravity |
| 04 | Bullet Hell Rush | WASD · **hold Shift** | Drag · hold ◆ | Slow-mo phase shift + graze bonus |
| 05 | Grid Stacker | ← → · ↑ rotate · **Shift** hard drop | D-pad | Chain combos, gravity surge |
| 06 | Quantum Laser | Arrows + ◆ | Tap a mirror | Rotate optics to light every node |
| 07 | Memory Matrix | Arrows + ◆ | Tap pads | Rhythmic recall through glitch tears |
| 08 | Neon Flow | Arrows + ◆ | Drag wires | Route pairs without crossing |
| 09 | Neon Pong 2.0 | ↑ ↓ / W S | Mouse glide | Paddle motion imparts curve spin |
| 10 | Grid Pac-Runner | Arrows / WASD | D-pad | Surge cores flip the hunt |
| 11 | Cyber Soar | **Hold** Space / ↑ | Hold click | Continuous thruster, fuel burn |
| 12 | Retro Defender | Arrows + ◆ | Click / tap | Interceptor blasts chain-detonate |
| 13 | Outrun 2D Drive | ← → · **hold Shift** nitro | Steer by pointer | Pseudo-3D curved highway |
| 14 | Cyber Drift | ↑ throttle · ← → · **Shift** handbrake | D-pad | Grip/slip physics, drift scoring |
| 15 | Hyper Speed Dodge | ← → rotate · **Shift** burst | Tap left/right half | Wireframe tunnel, angular gaps |
| 16 | Grid Dash | Space jump (×2) · ↓ slide | Tap jump · ◆ | Land on the beat for PERFECT |

---

## 6. Project Structure

```
├── schema.sql                  # canonical PostgreSQL/Supabase script (Sub-Batch 4A)
├── .env.example                # env template (DATABASE_URL / JWT_SECRET / ADMIN_PASSWORD)
├── drizzle.config.json         # drizzle-kit push target
├── src/
│   ├── db/
│   │   ├── index.ts            # pg Pool + Drizzle client
│   │   ├── schema.ts           # users / games / scores / user_profiles (Drizzle)
│   │   └── seed.ts             # 16-game catalog + admin + level curve
│   ├── lib/api.ts              # CORS, JWT sign/verify, auth guards, validation
│   └── app/
│       ├── api/                # REST routes (Sub-Batch 4B)
│       └── page.tsx            # redirects / → /index.html
├── scripts/
│   └── game-harness.js         # headless canvas test harness for all 16 games
└── public/
    ├── index.html              # arcade shell
    ├── admin.html              # ops console
    ├── css/vortex.css          # design system + 4 theme presets
    └── js/
        ├── device-scanner.js   # hardware benchmark → perf tiers
        ├── vortex-engine.js    # ambient stage, themes, audio + equalizer
        ├── vortex-fx.js        # FX core: particles, shake, input, HiDPI harness
        ├── neon-snake.js       # game 01
        ├── games-action.js     # games 02-04
        ├── games-puzzle.js     # games 05-08
        ├── games-retro.js      # games 09-12
        ├── games-racing.js     # games 13-16
        ├── vortex-gamification.js
        ├── vortex-interactions.js
        ├── db.js               # hybrid local-first API client
        └── admin.js
```

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `DATABASE_URL is required` | Create `.env` from `.env.example` and restart the server. |
| `ECONNREFUSED 127.0.0.1:5432` | Postgres isn't running — start the service or the Docker container. |
| `relation "users" does not exist` | Run step 4 (`npx drizzle-kit push` **or** `psql … -f schema.sql`). |
| `password authentication failed` | Check credentials in `DATABASE_URL`; for Supabase use the **pooler** host. |
| Port 3000 already in use | `PORT=3001 npm start` (or `npm run dev -- -p 3001`). |
| Admin login rejected | Confirm the account exists: `psql $DATABASE_URL -c "SELECT email, role FROM users;"` |
| No audio | Browsers gate audio behind the first click — press the HUD play button. |
| Low FPS overlay tier | The device scanner intentionally degraded FX (`perf-low`); grid stays 60+ FPS. |

---

## 8. Security Notes

- Passwords are hashed with **bcrypt (cost 10)** — never stored in plaintext.
- Auth uses **JWT (7-day expiry)** sent via `Authorization: Bearer` headers.
- Admin endpoints double-check `role = 'admin'` from the live database, not just the token.
- Change `JWT_SECRET` and `ADMIN_PASSWORD` before any real deployment.

© 2026 VORTEX GAMING — built inside the web, for the web.
