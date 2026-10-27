import { FREE_GAME_COOLDOWN_MS, type User } from "@2t2m/shared";
import type { UserRow } from "./db/schema.js";

/** Stripe-Status, die Zugriff auf Pro gewähren. */
const PRO_STATUSES = new Set(["active", "trialing"]);

export function isPro(user: UserRow): boolean {
  return user.subscriptionStatus !== null && PRO_STATUSES.has(user.subscriptionStatus);
}

/** Zeitpunkt (ms), ab dem ein kostenloser Spieler wieder spielen darf; null = sofort bzw. Pro. */
export function nextGameAt(user: UserRow, now = Date.now()): number | null {
  if (isPro(user) || !user.lastGameStartedAt) return null;
  const next = user.lastGameStartedAt.getTime() + FREE_GAME_COOLDOWN_MS;
  return next > now ? next : null;
}

export function toUser(row: UserRow): User {
  const next = nextGameAt(row);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt.toISOString(),
    pro: isPro(row),
    subscription: row.subscriptionStatus
      ? {
          status: row.subscriptionStatus,
          periodEnd: row.subscriptionPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: row.cancelAtPeriodEnd,
        }
      : null,
    nextGameAt: next ? new Date(next).toISOString() : null,
  };
}
