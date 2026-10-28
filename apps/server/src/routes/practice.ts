import { Router, type NextFunction, type Request, type Response } from "express";
import { asc, eq, sql } from "drizzle-orm";
import {
  isQuestionKind,
  PRACTICE_STREAK_TO_LEARN,
  type PracticeAnswerResponse,
  type PracticeItem,
  type PracticeResponse,
} from "@2t2m/shared";
import { isPro } from "../account.js";
import { requireAuth } from "../auth.js";
import { db, schema } from "../db/index.js";
import { COUNTRY_BY_CODE, practiceQuestion } from "../game/questions.js";

const { matches, matchAnswers, practiceAnswers } = schema;

function requirePro(req: Request, res: Response, next: NextFunction) {
  if (!isPro(req.user!)) {
    res.status(403).json({ error: "pro_required" });
    return;
  }
  next();
}

/**
 * Alle Antworten aus Duellen und Übung in zeitlicher Reihenfolge: Wer ein Land einmal falsch hatte,
 * muss es danach mehrmals in Folge richtig haben, bis es aus der Übungsliste verschwindet.
 */
async function practicePool(userId: string): Promise<PracticeResponse> {
  const [ranked, practiced] = await Promise.all([
    db
      .select({
        code: matchAnswers.countryCode,
        kind: matchAnswers.kind,
        correct: matchAnswers.correct,
        at: sql<string>`${matches.startedAt} + ${matchAnswers.elapsedMs} * interval '1 millisecond'`,
      })
      .from(matchAnswers)
      .innerJoin(matches, eq(matches.id, matchAnswers.matchId))
      .where(eq(matchAnswers.userId, userId)),
    db
      .select({
        code: practiceAnswers.countryCode,
        kind: practiceAnswers.kind,
        correct: practiceAnswers.correct,
        at: practiceAnswers.answeredAt,
      })
      .from(practiceAnswers)
      .where(eq(practiceAnswers.userId, userId))
      .orderBy(asc(practiceAnswers.answeredAt)),
  ]);

  const answers = [...ranked, ...practiced]
    .map((a) => ({ ...a, at: new Date(a.at).getTime() }))
    .sort((a, b) => a.at - b.at);

  const byKey = new Map<string, PracticeItem>();
  for (const a of answers) {
    const country = COUNTRY_BY_CODE.get(a.code);
    if (!country || !isQuestionKind(a.kind)) continue;
    const key = `${a.kind}:${a.code}`;
    const item = byKey.get(key) ?? { code: a.code, kind: a.kind, name: country.name, wrong: 0, streak: 0 };
    if (a.correct) item.streak++;
    else {
      item.wrong++;
      item.streak = 0;
    }
    byKey.set(key, item);
  }

  const mistakes = [...byKey.values()].filter((i) => i.wrong > 0);
  const items = mistakes
    .filter((i) => i.streak < PRACTICE_STREAK_TO_LEARN)
    .sort((a, b) => b.wrong - a.wrong || a.streak - b.streak);
  return { items, learned: mistakes.length - items.length };
}

export const practiceRouter = Router();
practiceRouter.use(requireAuth, requirePro);

practiceRouter.get("/", async (req, res) => {
  res.json(await practicePool(req.user!.id));
});

practiceRouter.get("/question", (req, res) => {
  const { code, kind } = req.query;
  const question = typeof code === "string" && isQuestionKind(kind) ? practiceQuestion(code, kind) : null;
  if (!question) {
    res.status(400).json({ error: "invalid_question" });
    return;
  }
  res.json(question);
});

practiceRouter.post("/answer", async (req, res) => {
  const { countryCode, kind, answerCode } = req.body ?? {};
  if (typeof countryCode !== "string" || !COUNTRY_BY_CODE.has(countryCode) || !isQuestionKind(kind) || typeof answerCode !== "string") {
    res.status(400).json({ error: "invalid_question" });
    return;
  }
  const userId = req.user!.id;
  const correct = answerCode === countryCode;
  await db.insert(practiceAnswers).values({ userId, countryCode, kind, correct });
  const pool = await practicePool(userId);
  const body: PracticeAnswerResponse = {
    correct,
    item: pool.items.find((i) => i.code === countryCode && i.kind === kind) ?? null,
  };
  res.json(body);
});
