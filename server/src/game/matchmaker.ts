import { isModeId, matchmakingRange, type ModeId, type PublicPlayer } from "@2t2m/shared";
import { findUser, userIdFromCookieHeader } from "../auth.js";
import { getOrCreateRating } from "./persist.js";
import { Match, userRoom } from "./match.js";
import type { GameServer, GameSocket } from "./types.js";

interface QueueEntry {
  player: PublicPlayer;
  mode: ModeId;
  joinedAt: number;
}

const TICK_MS = 1000;

export class Matchmaker {
  private readonly queue = new Map<string, QueueEntry>();
  private readonly matchesByUser = new Map<string, Match>();

  constructor(private readonly io: GameServer) {
    setInterval(() => this.tick(), TICK_MS).unref();
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

    socket.on("queue:join", async (payload) => {
      try {
        if (!isModeId(payload?.mode)) return;
        if (this.matchesByUser.has(userId) || this.queue.has(userId)) return;
        const [user, rating] = await Promise.all([findUser(userId), getOrCreateRating(userId, payload.mode)]);
        if (!user) return;
        const entry: QueueEntry = {
          mode: payload.mode,
          joinedAt: Date.now(),
          player: { id: user.id, name: user.name, avatarUrl: user.avatarUrl, rating: rating.rating },
        };
        this.queue.set(userId, entry);
        this.io.to(userRoom(userId)).emit("queue:joined", { mode: entry.mode, rating: entry.player.rating, since: entry.joinedAt });
        this.tick();
      } catch (err) {
        console.error(err);
        socket.emit("app:error", { message: "Matchmaking ist gerade nicht verfügbar." });
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
    const now = Date.now();
    const waiting = [...this.queue.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    const matched = new Set<string>();

    for (const a of waiting) {
      if (matched.has(a.player.id)) continue;
      let best: QueueEntry | null = null;
      let bestDiff = Infinity;
      for (const b of waiting) {
        if (b === a || matched.has(b.player.id) || b.mode !== a.mode) continue;
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
      for (const id of m.playerIds) if (this.matchesByUser.get(id) === m) this.matchesByUser.delete(id);
    });
    this.matchesByUser.set(a.player.id, match);
    this.matchesByUser.set(b.player.id, match);
    match.start();
  }
}
