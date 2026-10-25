import type { Outcome } from "@2t2m/shared";

/** Neue Spieler steigen schneller auf/ab, bis ihr Rating sich eingependelt hat. */
function kFactor(games: number): number {
  if (games < 10) return 40;
  if (games < 30) return 32;
  return 24;
}

export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

export function ratingDelta(rating: number, opponentRating: number, outcome: Outcome, games: number): number {
  const actual = outcome === "win" ? 1 : outcome === "draw" ? 0.5 : 0;
  const delta = Math.round(kFactor(games) * (actual - expectedScore(rating, opponentRating)));
  // Ein Sieg bringt immer mindestens einen Punkt, eine Niederlage kostet immer mindestens einen.
  if (outcome === "win") return Math.max(1, delta);
  if (outcome === "loss") return Math.min(-1, delta);
  return delta;
}
