import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  serial,
  real,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/* VORTEX GAMING — relational schema                                   */
/* users (1) ───< scores >─── (1) games                                */
/* users (1) ───── user_profiles (1)                                   */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: varchar("username", { length: 32 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 16 }).notNull().default("player"), // player | admin
    status: varchar("status", { length: 16 }).notNull().default("active"), // active | banned
    totalXp: integer("total_xp").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_username_unique").on(t.username),
    uniqueIndex("users_email_unique").on(t.email),
    index("users_created_at_idx").on(t.createdAt),
  ],
);

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 48 }).notNull().unique(),
  title: varchar("title", { length: 96 }).notNull(),
  category: varchar("category", { length: 48 }).notNull(),
  mode: varchar("mode", { length: 24 }).notNull(),
  tagline: varchar("tagline", { length: 200 }).default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scores = pgTable(
  "scores",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: integer("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    xpEarned: integer("xp_earned").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("scores_game_idx").on(t.gameId, t.score),
    index("scores_user_idx").on(t.userId),
    index("scores_created_at_idx").on(t.createdAt),
  ],
);

export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 48 }),
  avatarHue: integer("avatar_hue").notNull().default(190),
  level: integer("level").notNull().default(1),
  lastGameKey: varchar("last_game_key", { length: 48 }),
  registrationDate: timestamp("registration_date", { withTimezone: true }).notNull().defaultNow(),
  totalLoginCount: integer("total_login_count").notNull().default(1),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }).notNull().defaultNow(),
  deviceSignature: varchar("device_signature", { length: 96 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* ENTERPRISE TELEMETRY (v3.0) — session, game logs, receipt ledger   */
/* ------------------------------------------------------------------ */

export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" }),
    loginAt: timestamp("login_at", { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
    activeTimeSeconds: integer("active_time_seconds").notNull().default(0),
    idleTimeSeconds: integer("idle_time_seconds").notNull().default(0),
    status: varchar("status", { length: 16 }).notNull().default("ACTIVE"), // ACTIVE | CLOSED | TIMED_OUT
    deviceSignature: varchar("device_signature", { length: 96 }),
  },
  (t) => [
    index("user_sessions_user_idx").on(t.userId, t.status),
    check("user_sessions_status_check", sql`${t.status} in ('ACTIVE', 'CLOSED', 'TIMED_OUT')`),
    check("user_sessions_active_check", sql`${t.activeTimeSeconds} >= 0`),
    check("user_sessions_idle_check", sql`${t.idleTimeSeconds} >= 0`),
  ],
);

export const gameActivityLogs = pgTable(
  "game_activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionKey: varchar("session_key", { length: 64 }).notNull().unique(), // idempotency key
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    gameKey: varchar("game_key", { length: 64 }).notNull(),
    gameName: varchar("game_name", { length: 128 }).notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    status: varchar("status", { length: 8 }).notNull(), // WON | LOST | QUIT
    finalScore: integer("final_score").notNull().default(0),
    scoreVelocity: real("score_velocity").notNull().default(0),
    checksum: varchar("checksum", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("game_logs_user_idx").on(t.userId, t.createdAt),
    index("game_logs_game_idx").on(t.gameKey, t.createdAt),
    index("game_logs_created_idx").on(t.createdAt),
    check("game_logs_status_check", sql`${t.status} in ('WON', 'LOST', 'QUIT')`),
    check("game_logs_duration_check", sql`${t.durationSeconds} >= 0`),
    check("game_logs_score_check", sql`${t.finalScore} >= 0`),
    check("game_logs_velocity_check", sql`${t.scoreVelocity} >= 0`),
  ],
);

export const receiptAudits = pgTable(
  "receipt_audits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    receiptNumber: varchar("receipt_number", { length: 32 }).notNull().unique(),
    receiptHash: varchar("receipt_hash", { length: 128 }).notNull().unique(),
    payloadHash: varchar("payload_hash", { length: 128 }).notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("receipt_audits_user_idx").on(t.userId, t.generatedAt)],
);

export type User = typeof users.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Score = typeof scores.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
