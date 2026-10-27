import { randomInt } from "node:crypto";
import type { ModeId, PublicPlayer } from "@2t2m/shared";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { getOrCreateRating } from "./persist.js";

/** Namen der Ersatzgegner – sollen wie normale Spieler wirken. */
const BOT_NAMES = [
  "Lukas M.", "Sophie", "maxi_k", "Jonas Weber", "Lena", "flagfan99", "Tim B.", "Mia Schulz", "Noah",
  "Emma K.", "geo_nerd", "Paul", "Hannah", "Felix R.", "Lara", "worldwalker", "Ben", "Anna Fischer",
  "Leon", "Marie", "atlas_ace", "David", "Clara", "Nico", "Julia W.", "Elias", "kartenkind", "Sarah",
  "Finn", "Luisa", "mapmaster", "Jan", "Amelie", "Tom H.", "Nora", "compass_kid",
];

/** So weit darf das Rating des Bots vom echten Spieler abweichen. */
const RATING_JITTER = 60;
const RATING_FLOOR = 100;

/** Bots, die gerade in einem Duell sind – jeder Bot spielt immer nur ein Duell gleichzeitig. */
const busy = new Set<string>();

const emailFor = (name: string) =>
  `bot-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}@bots.2t2m.local`;

/**
 * Holt einen freien Bot und setzt sein Rating knapp neben das des Spielers,
 * damit das Duell wie ein normales Matchmaking-Ergebnis aussieht.
 */
export async function acquireBot(mode: ModeId, opponentRating: number): Promise<PublicPlayer | null> {
  const free = BOT_NAMES.filter((name) => !busy.has(emailFor(name)));
  if (free.length === 0) return null;
  const name = free[randomInt(free.length)]!;
  const email = emailFor(name);
  busy.add(email);

  try {
    const [bot] = await db
      .insert(schema.users)
      .values({ email, name, avatarUrl: null, isBot: true })
      .onConflictDoUpdate({ target: schema.users.email, set: { lastSeenAt: new Date(), isBot: true } })
      .returning();
    const current = await getOrCreateRating(bot!.id, mode);
    const rating = Math.max(RATING_FLOOR, opponentRating + randomInt(-RATING_JITTER, RATING_JITTER + 1));
    await db
      .update(schema.ratings)
      .set({ rating, peakRating: Math.max(current.peakRating, rating) })
      .where(and(eq(schema.ratings.userId, bot!.id), eq(schema.ratings.mode, mode)));
    return { id: bot!.id, name: bot!.name, avatarUrl: null, rating };
  } catch (err) {
    busy.delete(email);
    throw err;
  }
}

export function releaseBot(bot: PublicPlayer) {
  busy.delete(emailFor(bot.name));
}

/** Zufällige Bedenkzeit pro Frage, damit der Bot nicht maschinell gleichmäßig antwortet. */
export function botThinkingMs(): number {
  return randomInt(1200, 4000);
}
