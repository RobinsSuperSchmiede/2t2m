import { Router } from "express";
import { and, count, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import {
  type BackdropItem,
  DEFAULT_MODE,
  type CountryStat,
  type DashboardDetails,
  DEFAULT_SETTINGS,
  type GameSettings,
  isGameSettings,
  isModeId,
  LANGUAGES,
  type LocalizedText,
  type DashboardResponse,
  type HistoryResponse,
  type LeaderboardEntry,
  type MatchHistoryItem,
  type ModeId,
  type ModeStats,
  type Outcome,
  type QuestionKind,
} from "@2t2m/shared";
import { isPro } from "../account.js";
import { requireAuth } from "../auth.js";
import { db, schema } from "../db/index.js";
import type { MatchRow } from "../db/schema.js";
import { getOrCreateRating } from "../game/persist.js";
import { COUNTRIES, OUTLINE_SIZE } from "../game/questions.js";

const fallbackName = (code: string) => Object.fromEntries(LANGUAGES.map((l) => [l, code])) as LocalizedText;

const { matches, users, ratings, matchAnswers } = schema;

function modeFrom(value: unknown): ModeId {
  return isModeId(value) ? value : DEFAULT_MODE;
}

function settingsFrom(m: MatchRow): GameSettings {
  const settings = { durationSec: m.durationSec, questions: m.questions };
  return isGameSettings(settings) ? settings : DEFAULT_SETTINGS;
}

const involves = (userId: string) => or(eq(matches.player1Id, userId), eq(matches.player2Id, userId));

/** Wandelt Match-Zeilen in die Sicht eines Spielers um (er ist immer "du"). */
async function toHistoryItems(userId: string, rows: MatchRow[]): Promise<MatchHistoryItem[]> {
  const opponentIds = [...new Set(rows.map((m) => (m.player1Id === userId ? m.player2Id : m.player1Id)))];
  const opponents = opponentIds.length
    ? await db.select().from(users).where(inArray(users.id, opponentIds))
    : [];
  const byId = new Map(opponents.map((u) => [u.id, u]));

  return rows.map((m) => {
    const mine = m.player1Id === userId;
    const opponentId = mine ? m.player2Id : m.player1Id;
    const opponent = byId.get(opponentId);
    const ratingBefore = mine ? m.player1RatingBefore : m.player2RatingBefore;
    const ratingAfter = mine ? m.player1RatingAfter : m.player2RatingAfter;
    const outcome: Outcome = m.winnerId === null ? "draw" : m.winnerId === userId ? "win" : "loss";
    return {
      id: m.id,
      mode: modeFrom(m.mode),
      settings: settingsFrom(m),
      outcome,
      score: mine ? m.player1Score : m.player2Score,
      opponentScore: mine ? m.player2Score : m.player1Score,
      ratingBefore,
      ratingAfter,
      delta: ratingAfter - ratingBefore,
      forfeit: m.forfeit,
      endedAt: m.endedAt.toISOString(),
      opponent: {
        id: opponentId,
        name: opponent?.name ?? "?",
        avatarUrl: opponent?.avatarUrl ?? null,
        rating: mine ? m.player2RatingAfter : m.player1RatingAfter,
      },
    };
  });
}

async function modeStats(userId: string, mode: ModeId): Promise<ModeStats> {
  const rating = await getOrCreateRating(userId, mode);
  let rank: number | null = null;
  if (rating.games > 0) {
    const [row] = await db
      .select({ n: count() })
      .from(ratings)
      .innerJoin(users, eq(users.id, ratings.userId))
      .where(
        and(eq(ratings.mode, mode), gt(ratings.games, 0), gt(ratings.rating, rating.rating), eq(users.isBot, false)),
      );
    rank = (row?.n ?? 0) + 1;
  }
  return {
    mode,
    rating: rating.rating,
    peakRating: rating.peakRating,
    games: rating.games,
    wins: rating.wins,
    losses: rating.losses,
    draws: rating.draws,
    rank,
  };
}

/** Öffentlich, auch ohne Anmeldung sichtbar. */
export const publicStatsRouter = Router();

const BACKDROP_SIZE = 14;

/** Zufällige Flaggen und Umrisse für den animierten Hintergrund. */
publicStatsRouter.get("/backdrop", (_req, res) => {
  const items: BackdropItem[] = [];
  const pool = [...COUNTRIES].sort(() => Math.random() - 0.5);
  for (const c of pool) {
    if (items.length >= BACKDROP_SIZE) break;
    const wantFlag = items.length % 2 === 0;
    if (wantFlag && c.flagSvg) items.push({ type: "svg", markup: c.flagSvg });
    else if (c.outlinePath) items.push({ type: "path", d: c.outlinePath, viewBox: `0 0 ${OUTLINE_SIZE} ${OUTLINE_SIZE}` });
  }
  res.json(items);
});

export const statsRouter = Router();
statsRouter.use(requireAuth);

/** Detaillierte Auswertung – wird nur für Pro-Spieler berechnet. */
async function dashboardDetails(userId: string, mode: ModeId, history: MatchHistoryItem[]): Promise<DashboardDetails> {
  const where = and(eq(matches.mode, mode), involves(userId));
  const answersWhere = and(eq(matchAnswers.userId, userId), eq(matches.mode, mode));

  const [scoreAgg, kindRows, countryRows, speedRows] = await Promise.all([
    db
      .select({
        // Pro Minute, damit Duelle verschiedener Länge vergleichbar sind.
        avg: sql<string | null>`avg((case when ${matches.player1Id} = ${userId} then ${matches.player1Score} else ${matches.player2Score} end) * 60.0 / ${matches.durationSec})`,
        best: sql<number | null>`max(case when ${matches.player1Id} = ${userId} then ${matches.player1Score} else ${matches.player2Score} end) filter (where ${matches.durationSec} = 60)`,
      })
      .from(matches)
      .where(where),
    db
      .select({
        kind: matchAnswers.kind,
        correct: sql<number>`count(*) filter (where ${matchAnswers.correct})::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(matchAnswers)
      .innerJoin(matches, eq(matches.id, matchAnswers.matchId))
      .where(answersWhere)
      .groupBy(matchAnswers.kind),
    db
      .select({
        code: matchAnswers.countryCode,
        correct: sql<number>`count(*) filter (where ${matchAnswers.correct})::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(matchAnswers)
      .innerJoin(matches, eq(matches.id, matchAnswers.matchId))
      .where(answersWhere)
      .groupBy(matchAnswers.countryCode),
    // Antwortzeit = Abstand zur vorherigen Antwort im selben Duell.
    db.execute<{ avg: string | null }>(sql`
      select avg(gap)::float as avg from (
        select ${matchAnswers.elapsedMs} - coalesce(lag(${matchAnswers.elapsedMs}) over (
          partition by ${matchAnswers.matchId} order by ${matchAnswers.questionIndex}
        ), 0) as gap
        from ${matchAnswers}
        inner join ${matches} on ${matches.id} = ${matchAnswers.matchId}
        where ${matchAnswers.userId} = ${userId} and ${matches.mode} = ${mode}
      ) t
    `),
  ]);

  const chronological = [...history].reverse();
  const ratingHistory = chronological.length
    ? [
        { at: chronological[0]!.endedAt, rating: chronological[0]!.ratingBefore },
        ...chronological.map((m) => ({ at: m.endedAt, rating: m.ratingAfter })),
      ]
    : [];

  const totals = kindRows.reduce((acc, r) => ({ c: acc.c + r.correct, t: acc.t + r.total }), { c: 0, t: 0 });

  const names = new Map(COUNTRIES.map((c) => [c.code, c.name]));
  // Erst ab zwei Begegnungen aussagekräftig.
  const countries: CountryStat[] = countryRows
    .filter((r) => r.total >= 2)
    .map((r) => ({ code: r.code, name: names.get(r.code) ?? fallbackName(r.code), correct: r.correct, total: r.total }));
  const rate = (c: CountryStat) => c.correct / c.total;
  const weakest = [...countries].sort((a, b) => rate(a) - rate(b) || b.total - a.total).filter((c) => rate(c) < 1).slice(0, 5);
  const strongest = [...countries].sort((a, b) => rate(b) - rate(a) || b.total - a.total).filter((c) => rate(c) > 0).slice(0, 5);

  const avgAnswer = speedRows.rows[0]?.avg;
  return {
    accuracy: totals.t > 0 ? totals.c / totals.t : null,
    avgScore: scoreAgg[0]?.avg != null ? Number(scoreAgg[0].avg) : null,
    bestScore: scoreAgg[0]?.best ?? null,
    avgAnswerMs: avgAnswer != null ? Math.round(Number(avgAnswer)) : null,
    ratingHistory,
    kindAccuracy: (["flag", "outline"] as QuestionKind[]).map((kind) => {
      const row = kindRows.find((r) => r.kind === kind);
      return { kind, correct: row?.correct ?? 0, total: row?.total ?? 0 };
    }),
    weakestCountries: weakest,
    strongestCountries: strongest,
  };
}

statsRouter.get("/dashboard", async (req, res) => {
  const userId = req.user!.id;
  const mode = modeFrom(req.query.mode);

  const [stats, recentRows] = await Promise.all([
    modeStats(userId, mode),
    db
      .select()
      .from(matches)
      .where(and(eq(matches.mode, mode), involves(userId)))
      .orderBy(desc(matches.endedAt))
      .limit(50),
  ]);
  const history = await toHistoryItems(userId, recentRows);

  let streak: DashboardResponse["streak"] = { type: null, count: 0 };
  for (const m of history) {
    if (streak.type === null) streak = { type: m.outcome, count: 1 };
    else if (m.outcome === streak.type) streak.count++;
    else break;
  }

  const body: DashboardResponse = {
    stats,
    streak,
    recentMatches: history.slice(0, 5),
    details: isPro(req.user!) ? await dashboardDetails(userId, mode, history) : null,
  };
  res.json(body);
});

statsRouter.get("/history", async (req, res) => {
  const userId = req.user!.id;
  const mode = modeFrom(req.query.mode);
  const pageSize = 15;
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const where = and(eq(matches.mode, mode), involves(userId));

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(matches)
      .where(where)
      .orderBy(desc(matches.endedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: count() }).from(matches).where(where),
  ]);

  const body: HistoryResponse = {
    items: await toHistoryItems(userId, rows),
    total: totalRow[0]?.n ?? 0,
    page,
    pageSize,
  };
  res.json(body);
});

publicStatsRouter.get("/leaderboard", async (req, res) => {
  const mode = modeFrom(req.query.mode);
  const rows = await db
    .select({
      rating: ratings.rating,
      games: ratings.games,
      wins: ratings.wins,
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(ratings)
    .innerJoin(users, eq(users.id, ratings.userId))
    .where(and(eq(ratings.mode, mode), gt(ratings.games, 0), eq(users.isBot, false)))
    .orderBy(desc(ratings.rating), desc(ratings.wins))
    .limit(100);

  const body: LeaderboardEntry[] = rows.map((r, i) => ({
    rank: i + 1,
    games: r.games,
    wins: r.wins,
    player: { id: r.id, name: r.name, avatarUrl: r.avatarUrl, rating: r.rating },
  }));
  res.json(body);
});
