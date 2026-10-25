import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  googleId: text("google_id").unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Rating pro Spieler und Modus – jeder Modus hat seine eigene Rangliste. */
export const ratings = pgTable(
  "ratings",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(),
    rating: integer("rating").notNull(),
    peakRating: integer("peak_rating").notNull(),
    games: integer("games").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    draws: integer("draws").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.mode] }), index("ratings_mode_rating_idx").on(t.mode, t.rating)],
);

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey(),
    mode: text("mode").notNull(),
    player1Id: uuid("player1_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    player2Id: uuid("player2_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    player1Score: integer("player1_score").notNull(),
    player2Score: integer("player2_score").notNull(),
    player1RatingBefore: integer("player1_rating_before").notNull(),
    player1RatingAfter: integer("player1_rating_after").notNull(),
    player2RatingBefore: integer("player2_rating_before").notNull(),
    player2RatingAfter: integer("player2_rating_after").notNull(),
    /** null = Unentschieden */
    winnerId: uuid("winner_id").references(() => users.id, { onDelete: "set null" }),
    forfeit: boolean("forfeit").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("matches_player1_idx").on(t.player1Id, t.endedAt),
    index("matches_player2_idx").on(t.player2Id, t.endedAt),
  ],
);

/** Jede einzelne Antwort – Grundlage für Statistiken wie Trefferquote. */
export const matchAnswers = pgTable(
  "match_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionIndex: integer("question_index").notNull(),
    kind: text("kind").notNull(),
    countryCode: text("country_code").notNull(),
    correct: boolean("correct").notNull(),
    elapsedMs: integer("elapsed_ms").notNull(),
  },
  (t) => [index("match_answers_user_idx").on(t.userId), index("match_answers_match_idx").on(t.matchId)],
);

export const usersRelations = relations(users, ({ many }) => ({
  ratings: many(ratings),
}));

export const ratingsRelations = relations(ratings, ({ one }) => ({
  user: one(users, { fields: [ratings.userId], references: [users.id] }),
}));

export type UserRow = typeof users.$inferSelect;
export type RatingRow = typeof ratings.$inferSelect;
export type MatchRow = typeof matches.$inferSelect;
