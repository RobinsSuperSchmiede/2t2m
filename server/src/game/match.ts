import { randomInt, randomUUID } from "node:crypto";
import {
  GAME_DURATION_MS,
  INTRO_DURATION_MS,
  WRONG_ANSWER_PENALTY_MS,
  type GameEndPayload,
  type GameStatePayload,
  type MatchFoundPayload,
  type ModeId,
  type PublicPlayer,
} from "@2t2m/shared";
import { persistMatch, type AnswerRecord } from "./persist.js";
import { QuestionSequence } from "./questions.js";
import type { GameServer } from "./types.js";

/** Kleiner Puffer für Netzwerk-Latenz bei Antworten kurz vor Schluss. */
const END_GRACE_MS = 300;

interface PlayerState {
  info: PublicPlayer;
  score: number;
  currentIndex: number;
  lockedUntil: number;
  answers: AnswerRecord[];
  forfeited: boolean;
}

export const userRoom = (userId: string) => `user:${userId}`;

export class Match {
  readonly id = randomUUID();
  readonly startsAt: number;
  readonly endsAt: number;
  private readonly players: [PlayerState, PlayerState];
  private readonly questions = new QuestionSequence(randomInt(2 ** 31));
  private readonly timers: NodeJS.Timeout[] = [];
  private finished = false;

  constructor(
    private readonly io: GameServer,
    readonly mode: ModeId,
    a: PublicPlayer,
    b: PublicPlayer,
    private readonly onFinished: (match: Match) => void,
  ) {
    const now = Date.now();
    this.startsAt = now + INTRO_DURATION_MS;
    this.endsAt = this.startsAt + GAME_DURATION_MS;
    const init = (info: PublicPlayer): PlayerState => ({
      info,
      score: 0,
      currentIndex: 0,
      lockedUntil: 0,
      answers: [],
      forfeited: false,
    });
    this.players = [init(a), init(b)];
  }

  get playerIds(): [string, string] {
    return [this.players[0].info.id, this.players[1].info.id];
  }

  start() {
    for (const [me, opponent] of this.pairs()) {
      this.io.to(userRoom(me.info.id)).emit("match:found", this.foundPayload(me, opponent));
    }
    this.timers.push(
      setTimeout(() => {
        for (const p of this.players) this.sendQuestion(p);
      }, this.startsAt - Date.now()),
      setTimeout(() => void this.finish(), this.endsAt - Date.now() + END_GRACE_MS),
    );
  }

  /** Aktuellen Stand an einen (wieder) verbundenen Spieler schicken. */
  sendState(userId: string) {
    const pair = this.pairs().find(([me]) => me.info.id === userId);
    if (!pair || this.finished) return;
    const [me, opponent] = pair;
    const payload: GameStatePayload = {
      ...this.foundPayload(me, opponent),
      score: me.score,
      opponentScore: opponent.score,
      question: Date.now() >= this.startsAt ? this.questions.get(me.currentIndex).public : null,
      lockedUntil: me.lockedUntil,
    };
    this.io.to(userRoom(userId)).emit("game:state", payload);
  }

  answer(userId: string, questionIndex: number, option: number) {
    const pair = this.pairs().find(([me]) => me.info.id === userId);
    if (!pair || this.finished) return;
    const [me, opponent] = pair;
    const now = Date.now();
    if (now < this.startsAt || now > this.endsAt + END_GRACE_MS) return;
    if (questionIndex !== me.currentIndex || now < me.lockedUntil) return;

    const question = this.questions.get(questionIndex);
    const correct = option === question.correctOption;
    me.answers.push({
      questionIndex,
      kind: question.public.kind,
      countryCode: question.countryCode,
      correct,
      elapsedMs: now - this.startsAt,
    });
    me.currentIndex++;
    if (correct) me.score++;
    else me.lockedUntil = now + WRONG_ANSWER_PENALTY_MS;

    this.io.to(userRoom(me.info.id)).emit("game:answerResult", {
      questionIndex,
      correct,
      correctOption: question.correctOption,
      score: me.score,
      lockedUntil: me.lockedUntil,
    });
    if (correct) this.io.to(userRoom(opponent.info.id)).emit("game:opponentScore", { score: me.score });
    // Nach einer falschen Antwort kommt die nächste Frage erst, wenn die Strafzeit vorbei ist.
    const nextAt = Math.max(now, me.lockedUntil);
    if (nextAt < this.endsAt) {
      if (nextAt === now) this.sendQuestion(me);
      else this.timers.push(setTimeout(() => !this.finished && this.sendQuestion(me), nextAt - now));
    }
  }

  forfeit(userId: string) {
    const player = this.players.find((p) => p.info.id === userId);
    if (!player || this.finished) return;
    player.forfeited = true;
    void this.finish();
  }

  private sendQuestion(player: PlayerState) {
    this.io.to(userRoom(player.info.id)).emit("game:question", this.questions.get(player.currentIndex).public);
  }

  private pairs(): [PlayerState, PlayerState][] {
    return [
      [this.players[0], this.players[1]],
      [this.players[1], this.players[0]],
    ];
  }

  private foundPayload(me: PlayerState, opponent: PlayerState): MatchFoundPayload {
    return {
      matchId: this.id,
      mode: this.mode,
      you: me.info,
      opponent: opponent.info,
      startsAt: this.startsAt,
      endsAt: this.endsAt,
      serverNow: Date.now(),
    };
  }

  private async finish() {
    if (this.finished) return;
    this.finished = true;
    for (const t of this.timers) clearTimeout(t);

    const forfeit = this.players.some((p) => p.forfeited);
    const toFinished = (p: PlayerState) => ({
      userId: p.info.id,
      score: p.score,
      answers: p.answers,
      forfeited: p.forfeited,
    });

    try {
      const results = await persistMatch({
        id: this.id,
        mode: this.mode,
        startedAt: new Date(this.startsAt),
        endedAt: new Date(),
        players: [toFinished(this.players[0]), toFinished(this.players[1])],
      });
      const resultFor = (i: 0 | 1) => ({
        id: this.players[i].info.id,
        score: this.players[i].score,
        answered: this.players[i].answers.length,
        ratingBefore: results[i].ratingBefore,
        ratingAfter: results[i].ratingAfter,
        delta: results[i].delta,
      });
      for (const i of [0, 1] as const) {
        const other = i === 0 ? 1 : 0;
        const payload: GameEndPayload = {
          matchId: this.id,
          outcome: results[i].outcome,
          you: resultFor(i),
          opponent: resultFor(other),
          forfeit,
        };
        this.io.to(userRoom(this.players[i].info.id)).emit("game:end", payload);
      }
    } catch (err) {
      console.error(`Match ${this.id} konnte nicht gespeichert werden`, err);
      for (const p of this.players) {
        this.io.to(userRoom(p.info.id)).emit("app:error", { message: "Das Match konnte nicht gespeichert werden." });
      }
    } finally {
      this.onFinished(this);
    }
  }
}
