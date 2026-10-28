// Gemeinsame Typen und Konstanten für Server und Client.

/** Zeit zwischen "Match gefunden" und Spielstart (VS-Intro + Countdown). */
export const INTRO_DURATION_MS = 6_000;
/** Sperrzeit nach einer falschen Antwort, damit wildes Raten sich nicht lohnt. */
export const WRONG_ANSWER_PENALTY_MS = 1_000;
export const STARTING_RATING = 1000;

/** Kostenlose Spieler dürfen ein Duell pro Stunde starten. */
export const FREE_GAME_COOLDOWN_MS = 60 * 60 * 1000;
export const PRO_PRICE_LABEL = "3 €";

/** Erlaubter Rating-Abstand im Matchmaking – wächst mit der Wartezeit, damit niemand ewig wartet. */
export function matchmakingRange(waitedMs: number): number {
  return Math.min(600, 100 + Math.floor(waitedMs / 1000) * 20);
}

// ---------------------------------------------------------------------------
// Sprachen – Texte der Oberfläche übersetzt der Client, der Server liefert nur Ländernamen mit.
// ---------------------------------------------------------------------------

export const LANGUAGES = ["en", "de", "zh", "hi", "fr", "pt", "es"] as const;
export type Lang = (typeof LANGUAGES)[number];
export const DEFAULT_LANG: Lang = "en";
export type LocalizedText = Record<Lang, string>;

// ---------------------------------------------------------------------------
// Themen & Modi – so aufgebaut, dass später weitere Themen dazukommen können.
// ---------------------------------------------------------------------------

export type TopicId = "geography";
export type ModeId = "geo-flags-outlines";

export interface ModeInfo {
  id: ModeId;
  topic: TopicId;
  available: boolean;
}

export const MODES: Record<ModeId, ModeInfo> = {
  "geo-flags-outlines": {
    id: "geo-flags-outlines",
    topic: "geography",
    available: true,
  },
};

export const DEFAULT_MODE: ModeId = "geo-flags-outlines";

export function isModeId(value: unknown): value is ModeId {
  return typeof value === "string" && value in MODES;
}

// ---------------------------------------------------------------------------
// Spiel-Einstellungen – nur Spieler mit denselben Einstellungen treffen aufeinander.
// ---------------------------------------------------------------------------

export const GAME_DURATIONS_SEC = [30, 60, 120, 300] as const;
export type GameDurationSec = (typeof GAME_DURATIONS_SEC)[number];

/** Welche Fragen vorkommen: nur Flaggen, nur Umrisse oder beides gemischt. */
export const QUESTION_SETS = ["mixed", "flag", "outline"] as const;
export type QuestionSet = (typeof QUESTION_SETS)[number];

export interface GameSettings {
  durationSec: GameDurationSec;
  questions: QuestionSet;
}

export const DEFAULT_SETTINGS: GameSettings = { durationSec: 60, questions: "mixed" };

export function isGameSettings(value: unknown): value is GameSettings {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    GAME_DURATIONS_SEC.includes(v.durationSec as GameDurationSec) && QUESTION_SETS.includes(v.questions as QuestionSet)
  );
}

export const settingsKey = (s: GameSettings) => `${s.durationSec}:${s.questions}`;

// ---------------------------------------------------------------------------
// Rang-System
// ---------------------------------------------------------------------------

export type TierId = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master" | "grandmaster";

export interface Tier {
  id: TierId;
  min: number;
  /** Untergrenze der nächsten Stufe, null bei der höchsten Stufe. */
  next: number | null;
}

export const TIERS: Tier[] = [
  { id: "bronze", min: -Infinity, next: 900 },
  { id: "silver", min: 900, next: 1100 },
  { id: "gold", min: 1100, next: 1300 },
  { id: "platinum", min: 1300, next: 1500 },
  { id: "diamond", min: 1500, next: 1700 },
  { id: "master", min: 1700, next: 1900 },
  { id: "grandmaster", min: 1900, next: null },
];

export function getTier(rating: number): Tier {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (rating >= TIERS[i]!.min) return TIERS[i]!;
  }
  return TIERS[0]!;
}

/** Fortschritt (0–1) innerhalb der aktuellen Stufe. */
export function tierProgress(rating: number): number {
  const tier = getTier(rating);
  if (tier.next === null) return 1;
  const min = Number.isFinite(tier.min) ? tier.min : tier.next - 200;
  return Math.min(1, Math.max(0, (rating - min) / (tier.next - min)));
}

// ---------------------------------------------------------------------------
// Spiel
// ---------------------------------------------------------------------------

export type QuestionKind = "flag" | "outline";

export type QuestionImage =
  | { type: "svg"; markup: string }
  | { type: "path"; d: string; viewBox: string };

/** Zufällige Deko-Bilder für den animierten Hintergrund der Spielseite. */
export type BackdropItem = QuestionImage;

export interface Question {
  index: number;
  kind: QuestionKind;
  image: QuestionImage;
  /** Ländernamen in allen Sprachen. */
  options: LocalizedText[];
}

export interface PublicPlayer {
  id: string;
  name: string;
  avatarUrl: string | null;
  rating: number;
}

export interface MatchFoundPayload {
  matchId: string;
  mode: ModeId;
  settings: GameSettings;
  you: PublicPlayer;
  opponent: PublicPlayer;
  startsAt: number;
  endsAt: number;
  serverNow: number;
}

export interface AnswerResultPayload {
  questionIndex: number;
  correct: boolean;
  correctOption: number;
  score: number;
  lockedUntil: number;
}

export type Outcome = "win" | "loss" | "draw";

export interface PlayerResult {
  id: string;
  score: number;
  answered: number;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
}

export interface GameEndPayload {
  matchId: string;
  outcome: Outcome;
  you: PlayerResult;
  opponent: PlayerResult;
  forfeit: boolean;
}

export interface GameStatePayload extends MatchFoundPayload {
  score: number;
  opponentScore: number;
  question: Question | null;
  lockedUntil: number;
}

export interface QueueJoinedPayload {
  mode: ModeId;
  settings: GameSettings;
  rating: number;
  since: number;
}

export interface QueueDeniedPayload {
  reason: "cooldown";
  /** Zeitpunkt (ms), ab dem wieder gespielt werden darf. */
  nextGameAt: number;
}

export interface ServerToClientEvents {
  "queue:joined": (payload: QueueJoinedPayload) => void;
  "queue:denied": (payload: QueueDeniedPayload) => void;
  "queue:left": () => void;
  "match:found": (payload: MatchFoundPayload) => void;
  "game:state": (payload: GameStatePayload) => void;
  "game:question": (question: Question) => void;
  "game:answerResult": (payload: AnswerResultPayload) => void;
  "game:opponentScore": (payload: { score: number }) => void;
  "game:end": (payload: GameEndPayload) => void;
  /** `code` ist ein Fehlercode, den der Client übersetzt. */
  "app:error": (payload: { code: string }) => void;
}

export interface ClientToServerEvents {
  "queue:join": (payload: { mode: ModeId; settings: GameSettings }) => void;
  "queue:leave": () => void;
  "game:answer": (payload: { questionIndex: number; option: number }) => void;
  "game:forfeit": () => void;
}

// ---------------------------------------------------------------------------
// REST-API
// ---------------------------------------------------------------------------

export interface Subscription {
  status: string;
  /** Ende des bezahlten Zeitraums (Verlängerung oder Ablauf). */
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  pro: boolean;
  subscription: Subscription | null;
  /** Nur für kostenlose Spieler: ab wann das nächste Duell erlaubt ist (null = sofort). */
  nextGameAt: string | null;
}

export interface ModeStats {
  mode: ModeId;
  rating: number;
  peakRating: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  rank: number | null;
}

export interface MatchHistoryItem {
  id: string;
  mode: ModeId;
  settings: GameSettings;
  outcome: Outcome;
  score: number;
  opponentScore: number;
  ratingBefore: number;
  ratingAfter: number;
  delta: number;
  opponent: PublicPlayer;
  forfeit: boolean;
  endedAt: string;
}

export interface RatingPoint {
  at: string;
  rating: number;
}

export interface CountryStat {
  code: string;
  name: LocalizedText;
  correct: number;
  total: number;
}

/** Detaillierte Statistiken – nur für Pro-Spieler. */
export interface DashboardDetails {
  accuracy: number | null;
  /** Ø richtige Antworten pro Minute – vergleichbar über alle Spieldauern. */
  avgScore: number | null;
  /** Bestes Ergebnis in einem Duell mit Standard-Dauer (60 s). */
  bestScore: number | null;
  /** Ø Zeit pro Antwort in ms. */
  avgAnswerMs: number | null;
  ratingHistory: RatingPoint[];
  kindAccuracy: { kind: QuestionKind; correct: number; total: number }[];
  weakestCountries: CountryStat[];
  strongestCountries: CountryStat[];
}

export interface DashboardResponse {
  stats: ModeStats;
  streak: { type: Outcome | null; count: number };
  recentMatches: MatchHistoryItem[];
  details: DashboardDetails | null;
}

export interface HistoryResponse {
  items: MatchHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LeaderboardEntry {
  rank: number;
  player: PublicPlayer;
  games: number;
  wins: number;
}

// ---------------------------------------------------------------------------
// Übungsmodus (Pro) – Länder, die man falsch hatte, bis man sie sicher kann
// ---------------------------------------------------------------------------

/** So oft in Folge richtig, dann gilt ein Fehler als gelernt. */
export const PRACTICE_STREAK_TO_LEARN = 2;

export interface PracticeItem {
  code: string;
  kind: QuestionKind;
  name: LocalizedText;
  /** Wie oft insgesamt falsch beantwortet (Duelle und Übung). */
  wrong: number;
  /** Richtige Antworten in Folge seit dem letzten Fehler. */
  streak: number;
}

export interface PracticeResponse {
  items: PracticeItem[];
  /** Frühere Fehler, die inzwischen gelernt sind. */
  learned: number;
}

export interface PracticeQuestion {
  countryCode: string;
  kind: QuestionKind;
  image: QuestionImage;
  options: { code: string; name: LocalizedText }[];
}

export interface PracticeAnswerResponse {
  correct: boolean;
  /** Neuer Stand des Eintrags – null, wenn er damit gelernt ist. */
  item: PracticeItem | null;
}

export function isQuestionKind(value: unknown): value is QuestionKind {
  return value === "flag" || value === "outline";
}

export interface AuthConfigResponse {
  googleClientId: string | null;
  devLogin: boolean;
  stripeEnabled: boolean;
}
