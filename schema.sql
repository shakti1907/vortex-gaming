-- ============================================================================
-- VORTEX GAMING — PostgreSQL / Supabase Database Schema
-- ----------------------------------------------------------------------------
-- Canonical creation script. Safe to run multiple times (IF NOT EXISTS guards).
-- Works on:
--   * Local PostgreSQL 14+        ->  psql "$DATABASE_URL" -f schema.sql
--   * Supabase                    ->  paste into the SQL Editor and Run
-- The Drizzle ORM schema (src/db/schema.ts) mirrors this file 1:1, so running
-- `npx drizzle-kit push` produces the identical structure.
-- ============================================================================

-- Required for gen_random_uuid() (UUID PKs) and bcrypt gen_salt/crypt (admin seed)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. USERS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(32)  NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash TEXT         NOT NULL,
    role          VARCHAR(16)  NOT NULL DEFAULT 'player'
                    CONSTRAINT users_role_check   CHECK (role IN ('player', 'admin')),
    status        VARCHAR(16)  NOT NULL DEFAULT 'active'
                    CONSTRAINT users_status_check CHECK (status IN ('active', 'banned')),
    total_xp      INTEGER      NOT NULL DEFAULT 0
                    CONSTRAINT users_total_xp_check CHECK (total_xp >= 0),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique    ON users (email);
CREATE INDEX        IF NOT EXISTS users_created_at_idx  ON users (created_at);

-- ----------------------------------------------------------------------------
-- 2. GAMES  (the 16-title catalog)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS games (
    id         SERIAL PRIMARY KEY,
    key        VARCHAR(48) NOT NULL UNIQUE,
    title      VARCHAR(96) NOT NULL,
    category   VARCHAR(48) NOT NULL,
    mode       VARCHAR(24) NOT NULL,
    tagline    VARCHAR(200) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. SCORES  (users 1---N scores N---1 games, cascade on both sides)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scores (
    id         SERIAL PRIMARY KEY,
    user_id    UUID    NOT NULL
                 REFERENCES users (id) ON DELETE CASCADE,
    game_id    INTEGER NOT NULL
                 REFERENCES games (id) ON DELETE CASCADE,
    score      INTEGER NOT NULL CONSTRAINT scores_score_check CHECK (score >= 0),
    xp_earned  INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scores_game_idx       ON scores (game_id, score DESC);
CREATE INDEX IF NOT EXISTS scores_user_idx       ON scores (user_id);
CREATE INDEX IF NOT EXISTS scores_created_at_idx ON scores (created_at);

-- ----------------------------------------------------------------------------
-- 4. USER PROFILES  (1:1 with users, cascade)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id       UUID PRIMARY KEY
                  REFERENCES users (id) ON DELETE CASCADE,
    display_name  VARCHAR(48),
    avatar_hue    INTEGER NOT NULL DEFAULT 190,
    level         INTEGER NOT NULL DEFAULT 1,
    last_game_key VARCHAR(48),
    registration_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_login_count INTEGER NOT NULL DEFAULT 1,
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    device_signature VARCHAR(96),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Upgrade an existing pre-v3.0 database without data loss.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS registration_date TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS total_login_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS device_signature VARCHAR(96);

-- ----------------------------------------------------------------------------
-- 5. ENTERPRISE TELEMETRY (v3.0)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID REFERENCES users (id) ON DELETE CASCADE,
    login_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    active_time_seconds INTEGER NOT NULL DEFAULT 0 CHECK (active_time_seconds >= 0),
    idle_time_seconds   INTEGER NOT NULL DEFAULT 0 CHECK (idle_time_seconds >= 0),
    status              VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'CLOSED', 'TIMED_OUT')),
    device_signature    VARCHAR(96)
);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions (user_id, status);

CREATE TABLE IF NOT EXISTS game_activity_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_key         VARCHAR(64) NOT NULL UNIQUE,
    user_id             UUID REFERENCES users (id) ON DELETE SET NULL,
    game_key            VARCHAR(64) NOT NULL,
    game_name           VARCHAR(128) NOT NULL,
    start_time          TIMESTAMPTZ NOT NULL,
    end_time            TIMESTAMPTZ NOT NULL,
    duration_seconds    INTEGER NOT NULL CHECK (duration_seconds >= 0),
    status              VARCHAR(8) NOT NULL CHECK (status IN ('WON', 'LOST', 'QUIT')),
    final_score         INTEGER NOT NULL DEFAULT 0 CHECK (final_score >= 0),
    score_velocity      REAL NOT NULL DEFAULT 0 CHECK (score_velocity >= 0),
    checksum            VARCHAR(128) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Safe for both old VARCHAR telemetry schemas and already-upgraded REAL ones.
ALTER TABLE game_activity_logs ALTER COLUMN score_velocity DROP DEFAULT;
ALTER TABLE game_activity_logs ALTER COLUMN score_velocity TYPE REAL USING score_velocity::real;
ALTER TABLE game_activity_logs ALTER COLUMN score_velocity SET DEFAULT 0;
CREATE INDEX IF NOT EXISTS game_logs_user_idx ON game_activity_logs (user_id, created_at);
CREATE INDEX IF NOT EXISTS game_logs_game_idx ON game_activity_logs (game_key, created_at);
CREATE INDEX IF NOT EXISTS game_logs_created_idx ON game_activity_logs (created_at);

CREATE TABLE IF NOT EXISTS receipt_audits (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    receipt_number VARCHAR(32) NOT NULL UNIQUE,
    receipt_hash   VARCHAR(128) NOT NULL UNIQUE,
    payload_hash   VARCHAR(128) NOT NULL,
    generated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS receipt_audits_user_idx ON receipt_audits (user_id, generated_at);

-- ----------------------------------------------------------------------------
-- 6. GAME CATALOG SEED  (16 titles / 4 categories — idempotent upsert)
-- ----------------------------------------------------------------------------
INSERT INTO games (key, title, category, mode, tagline) VALUES
  ('neon-snake',        'Neon Snake',            'Action / Arcade',   'snake',    'Dash boosts, plasma trails, multi-stage cores.'),
  ('cyber-invaders',    'Cyber Invaders',        'Action / Arcade',   'shooter',  'Destructible shields and a sentinel boss core.'),
  ('asteroid-vector',   'Asteroid Vector',       'Action / Arcade',   'vector',   '360-degree inertia drift around a hungry singularity.'),
  ('bullet-hell-rush',  'Bullet Hell Rush',      'Action / Arcade',   'bullet',   'Procedural bullet storms - bend time to survive.'),
  ('grid-stacker',      'Cyber Grid Stacker',    'Puzzle / Strategy', 'tetris',   'Chain line clears before the gravity surge.'),
  ('quantum-laser',     'Quantum Laser Reflect', 'Puzzle / Strategy', 'optics',   'Rotate mirrors, bend the beam, light every node.'),
  ('memory-matrix',     'Memory Matrix',         'Puzzle / Strategy', 'sequence', 'Rhythmic sequence hacking through the glitch.'),
  ('neon-flow',         'Neon Flow',             'Puzzle / Strategy', 'flow',     'Route the power nodes - wires may never cross.'),
  ('neon-pong',         'Neon Pong 2.0',         'Retro / Classic',   'pong',     'Curve shots, paddle powerups, reactive walls.'),
  ('grid-pac-runner',   'Grid Pac-Runner',       'Retro / Classic',   'maze',     'Harvest data nodes, outwit the patrol sentinels.'),
  ('cyber-soar',        'Cyber Soar',            'Retro / Classic',   'flyer',    'Precision thruster flight through energy pillars.'),
  ('retro-defender',    'Retro Defender',        'Retro / Classic',   'defense',  'Intercept the warheads, save all six cities.'),
  ('outrun-drive',      'Outrun 2D Drive',       'Racing / Speed',    'pseudo3d', 'Pseudo-3D synthwave highway with nitro burn.'),
  ('cyber-drift',       'Cyber Drift',           'Racing / Speed',    'drift',    'Break traction and bank the drift multiplier.'),
  ('hyper-speed-dodge', 'Hyper Speed Dodge',     'Racing / Speed',    'tunnel',   'First-person wireframe tunnel at terminal velocity.'),
  ('grid-dash',         'Grid Dash',             'Racing / Speed',    'rhythm',   'Beat-locked jumps and slides over laser hazards.')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. DEFAULT ADMIN ACCOUNT  (matches the automatic app seed)
--    login email: admin@vortex.gg   password: VortexAdmin#2026  (change it!)
-- ----------------------------------------------------------------------------
INSERT INTO users (username, email, password_hash, role, status)
SELECT 'vortex_admin', 'admin@vortex.gg', crypt('VortexAdmin#2026', gen_salt('bf')), 'admin', 'active'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@vortex.gg');

INSERT INTO user_profiles (user_id, display_name, avatar_hue)
SELECT id, 'Vortex Admin', 45 FROM users
WHERE email = 'admin@vortex.gg'
ON CONFLICT (user_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- DONE. Verify with:  SELECT count(*) FROM games;  -- expect 16
-- ----------------------------------------------------------------------------
