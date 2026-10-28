import { and, eq, inArray } from "drizzle-orm";
import { STARTING_RATING, type GameSettings, type ModeId, type Outcome } from "@2t2m/shared";
import { db, schema, type Tx } from "../db/index.js";
import { ratingDelta } from "./elo.js";

const RATING_FLOOR = 100;

export async function getOrCreateRating(userId: string, mode: ModeId, tx: Tx | typeof db = db) {
  await tx
    .insert(schema.ratings)
    .values({ userId, mode, rating: STARTING_RATING, peakRating: STARTING_RATING })
    .onConflictDoNothing();
  const row = await tx.query.ratings.findFirst({
    where: and(eq(schema.ratings.userId, userId), eq(schema.ratings.mode, mode)),
  });
  return row!;
}

export interface AnswerRecord {
  questionIndex: number;
  kind: string;
  countryCode: string;
  correct: boolean;
  elapsedMs: number;
}

export interface FinishedPlayer {
  userId: string;
  score: number;
  answers: AnswerRecord[];
  forfeited: boolean;
}

export interface FinishedMatch {
  id: string;
  mode: ModeId;
  settings: GameSettings;
  startedAt: Date;
  endedAt: Date;
  players: [FinishedPlayer, FinishedPlayer];
}

export interface PersistedPlayerResult {
  outcome: Outcome;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
}

function outcomeFor(me: FinishedPlayer, other: FinishedPlayer): Outcome {
  if (me.forfeited !== other.forfeited) return me.forfeited ? "loss" : "win";
  if (me.score === other.score) return "draw";
  return me.score > other.score ? "win" : "loss";
}

/**
 * Speichert ein beendetes Match und berechnet die neuen Ratings – alles in einer
 * Transaktion mit Zeilensperre, damit parallele Matches sich nicht überschreiben.
 */
export async function persistMatch(match: FinishedMatch): Promise<[PersistedPlayerResult, PersistedPlayerResult]> {
  return db.transaction(async (tx) => {
    const [a, b] = match.players;
    await getOrCreateRating(a.userId, match.mode, tx);
    await getOrCreateRating(b.userId, match.mode, tx);

    const locked = await tx
      .select()
      .from(schema.ratings)
      .where(
        and(eq(schema.ratings.mode, match.mode), inArray(schema.ratings.userId, [a.userId, b.userId])),
      )
      .orderBy(schema.ratings.userId)
      .for("update");
    const ratingA = locked.find((r) => r.userId === a.userId)!;
    const ratingB = locked.find((r) => r.userId === b.userId)!;

    const results = ([
      [a, b, ratingA, ratingB],
      [b, a, ratingB, ratingA],
    ] as const).map(([me, other, mine, theirs]) => {
      const outcome = outcomeFor(me, other);
      const delta = ratingDelta(mine.rating, theirs.rating, outcome, mine.games);
      const ratingAfter = Math.max(RATING_FLOOR, mine.rating + delta);
      return { outcome, ratingBefore: mine.rating, ratingAfter, delta: ratingAfter - mine.rating };
    }) as [PersistedPlayerResult, PersistedPlayerResult];

    for (const [player, result, row] of [
      [a, results[0], ratingA],
      [b, results[1], ratingB],
    ] as const) {
      await tx
        .update(schema.ratings)
        .set({
          rating: result.ratingAfter,
          peakRating: Math.max(row.peakRating, result.ratingAfter),
          games: row.games + 1,
          wins: row.wins + (result.outcome === "win" ? 1 : 0),
          losses: row.losses + (result.outcome === "loss" ? 1 : 0),
          draws: row.draws + (result.outcome === "draw" ? 1 : 0),
          updatedAt: new Date(),
        })
        .where(and(eq(schema.ratings.userId, player.userId), eq(schema.ratings.mode, match.mode)));
    }

    const winnerId = results[0].outcome === "win" ? a.userId : results[1].outcome === "win" ? b.userId : null;
    await tx.insert(schema.matches).values({
      id: match.id,
      mode: match.mode,
      player1Id: a.userId,
      player2Id: b.userId,
      player1Score: a.score,
      player2Score: b.score,
      player1RatingBefore: results[0].ratingBefore,
      player1RatingAfter: results[0].ratingAfter,
      player2RatingBefore: results[1].ratingBefore,
      player2RatingAfter: results[1].ratingAfter,
      winnerId,
      forfeit: a.forfeited || b.forfeited,
      durationSec: match.settings.durationSec,
      questions: match.settings.questions,
      startedAt: match.startedAt,
      endedAt: match.endedAt,
    });

    const answers = match.players.flatMap((p) => p.answers.map((ans) => ({ ...ans, matchId: match.id, userId: p.userId })));
    if (answers.length > 0) await tx.insert(schema.matchAnswers).values(answers);

    return results;
  });
}
