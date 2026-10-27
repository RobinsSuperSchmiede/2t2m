import { FREE_GAME_COOLDOWN_MS, isModeId, matchmakingRange, type ModeId, type PublicPlayer } from "@2t2m/shared";
import { inArray } from "drizzle-orm";
import { isPro, nextGameAt } from "../account.js";
import { findUser, userIdFromCookieHeader } from "../auth.js";
import { db, schema } from "../db/index.js";
import { logger } from "../logger.js";
import { getOrCreateRating } from "./persist.js";
import { Match, userRoom } from "./match.js";
import type { GameServer, GameSocket } from "./types.js";

interface QueueEntry {
  player: PublicPlayer;
  mode: ModeId;
  joinedAt: number;
}

const TICK_MS = 1000;
/** Mindestabstand zwischen zwei Beitrittsversuchen pro Verbindung – schützt die DB vor Spam. */
const JOIN_THROTTLE_MS = 1000;

export class Matchmaker {
  private readonly queue = new Map<string, QueueEntry>();
  private readonly matchesByUser = new Map<string, Match>();
  /** Matchstarts der letzten Stunde – Absicherung, falls das Speichern in der DB fehlschlägt. */
  private readonly recentStarts = new Map<string, number>();
  private readonly activeMatches = new Set<Match>();
  private readonly ticker: NodeJS.Timeout;
  /** Beim Herunterfahren: keine neuen Duelle mehr, laufende werden zu Ende gespielt. */
  private draining = false;

  constructor(private readonly io: GameServer) {
    this.ticker = setInterval(() => this.tick(), TICK_MS);
    this.ticker.unref();
  }

  get stats() {
    return { queued: this.queue.size, activeMatches: this.activeMatches.size, draining: this.draining };
  }

  /**
   * Für Rolling Deploys: Wer nicht gerade spielt, wird getrennt und verbindet sich über den
   * Load Balancer mit der neuen Instanz (eine laufende Suche setzt der Client dort fort).
   * Danach wird gewartet, bis alle Duelle beendet und gespeichert sind – höchstens `timeoutMs`.
   */
  async drain(timeoutMs: number): Promise<void> {
    this.draining = true;
    clearInterval(this.ticker);
    this.queue.clear();
    for (const socket of this.io.sockets.sockets.values()) {
      if (!this.matchesByUser.has(socket.data.userId)) socket.disconnect(true);
    }

    const deadline = Date.now() + timeoutMs;
    while (this.activeMatches.size > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (this.activeMatches.size > 0) {
      logger.warn({ activeMatches: this.activeMatches.size }, "Shutdown-Timeout: laufende Duelle werden abgebrochen");
    }
    // Letzte Ergebnisse noch ausliefern lassen, bevor die Verbindungen geschlossen werden.
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  attach() {
    this.io.use(async (socket, next) => {
      const userId = userIdFromCookieHeader(socket.handshake.headers.cookie);
      if (!userId || !(await findUser(userId))) return next(new Error("unauthorized"));
      socket.data.userId = userId;
      next();
    });

    this.io.on("connection", (socket) => this.onConnection(socket));
  }

  private onConnection(socket: GameSocket) {
    const { userId } = socket.data;
    void socket.join(userRoom(userId));

    // Laufendes Match nach Reload/Verbindungsabbruch wieder aufnehmen.
    this.matchesByUser.get(userId)?.sendState(userId);
    const queued = this.queue.get(userId);
    if (queued) socket.emit("queue:joined", { mode: queued.mode, rating: queued.player.rating, since: queued.joinedAt });

    let lastJoinAttempt = 0;
    socket.on("queue:join", async (payload) => {
      try {
        if (!isModeId(payload?.mode)) return;
        const now = Date.now();
        if (now - lastJoinAttempt < JOIN_THROTTLE_MS) return;
        lastJoinAttempt = now;
        if (this.draining) {
          socket.emit("app:error", { code: "server_restarting" });
          return;
        }
        if (this.matchesByUser.has(userId) || this.queue.has(userId)) return;
        const [user, rating] = await Promise.all([findUser(userId), getOrCreateRating(userId, payload.mode)]);
        if (!user) return;
        // Stundenlimit für kostenlose Spieler – serverseitig, der Client zeigt nur den Timer.
        if (!isPro(user)) {
          const memNext = (this.recentStarts.get(userId) ?? 0) + FREE_GAME_COOLDOWN_MS;
          const next = Math.max(nextGameAt(user) ?? 0, memNext);
          if (next > Date.now()) {
            socket.emit("queue:denied", { reason: "cooldown", nextGameAt: next });
            return;
          }
        }
        // Zwischen den awaits könnte ein zweiter Tab schon beigetreten sein.
        if (this.matchesByUser.has(userId) || this.queue.has(userId)) return;
        const entry: QueueEntry = {
          mode: payload.mode,
          joinedAt: Date.now(),
          player: { id: user.id, name: user.name, avatarUrl: user.avatarUrl, rating: rating.rating },
        };
        this.queue.set(userId, entry);
        this.io.to(userRoom(userId)).emit("queue:joined", { mode: entry.mode, rating: entry.player.rating, since: entry.joinedAt });
        this.tick();
      } catch (err) {
        logger.error({ err, userId }, "Beitritt zur Warteschlange fehlgeschlagen");
        socket.emit("app:error", { code: "matchmaking_unavailable" });
      }
    });

    socket.on("queue:leave", () => {
      if (this.queue.delete(userId)) this.io.to(userRoom(userId)).emit("queue:left");
    });

    socket.on("game:answer", (payload) => {
      if (!Number.isInteger(payload?.questionIndex) || !Number.isInteger(payload?.option)) return;
      this.matchesByUser.get(userId)?.answer(userId, payload.questionIndex, payload.option);
    });

    socket.on("game:forfeit", () => this.matchesByUser.get(userId)?.forfeit(userId));

    socket.on("disconnect", async () => {
      // Erst aus der Warteschlange nehmen, wenn kein Tab des Nutzers mehr verbunden ist.
      const remaining = await this.io.in(userRoom(userId)).fetchSockets();
      if (remaining.length === 0) this.queue.delete(userId);
    });
  }

  private tick() {
    if (this.draining) return;
    // Pro Modus getrennt paaren; wer am längsten wartet, wird zuerst bedient.
    const byMode = new Map<ModeId, QueueEntry[]>();
    for (const entry of this.queue.values()) {
      const list = byMode.get(entry.mode) ?? [];
      list.push(entry);
      byMode.set(entry.mode, list);
    }
    for (const waiting of byMode.values()) {
      waiting.sort((a, b) => a.joinedAt - b.joinedAt);
      this.pair(waiting);
    }
  }

  private pair(waiting: QueueEntry[]) {
    const now = Date.now();
    const matched = new Set<string>();

    for (const a of waiting) {
      if (matched.has(a.player.id)) continue;
      let best: QueueEntry | null = null;
      let bestDiff = Infinity;
      for (const b of waiting) {
        if (b === a || matched.has(b.player.id)) continue;
        const diff = Math.abs(a.player.rating - b.player.rating);
        // Beide Spieler müssen den Abstand akzeptieren.
        const allowed = Math.min(matchmakingRange(now - a.joinedAt), matchmakingRange(now - b.joinedAt));
        if (diff <= allowed && diff < bestDiff) {
          best = b;
          bestDiff = diff;
        }
      }
      if (best) {
        matched.add(a.player.id);
        matched.add(best.player.id);
        this.startMatch(a, best);
      }
    }
  }

  private startMatch(a: QueueEntry, b: QueueEntry) {
    this.queue.delete(a.player.id);
    this.queue.delete(b.player.id);
    const match = new Match(this.io, a.mode, a.player, b.player, (m) => {
      this.activeMatches.delete(m);
      for (const id of m.playerIds) if (this.matchesByUser.get(id) === m) this.matchesByUser.delete(id);
      // Beim Herunterfahren nach dem Ergebnis zur neuen Instanz umziehen lassen (kurz warten, damit es ankommt).
      if (this.draining) {
        setTimeout(() => {
          for (const id of m.playerIds) this.io.in(userRoom(id)).disconnectSockets(true);
        }, 1000);
      }
    });
    this.activeMatches.add(match);
    this.matchesByUser.set(a.player.id, match);
    this.matchesByUser.set(b.player.id, match);
    match.start();
    logger.info({ matchId: match.id, mode: a.mode, players: match.playerIds }, "Duell gestartet");
    // Ab Matchbeginn zählt das Duell für das Stundenlimit.
    const now = Date.now();
    for (const [id, at] of this.recentStarts) if (at + FREE_GAME_COOLDOWN_MS < now) this.recentStarts.delete(id);
    this.recentStarts.set(a.player.id, now);
    this.recentStarts.set(b.player.id, now);
    db.update(schema.users)
      .set({ lastGameStartedAt: new Date() })
      .where(inArray(schema.users.id, [a.player.id, b.player.id]))
      .catch((err) => logger.error({ err }, "lastGameStartedAt konnte nicht gespeichert werden"));
  }
}
