import { createServer } from "node:http";
import { Server } from "socket.io";
import { createApp, type AppState } from "./app.js";
import { pool } from "./db/index.js";
import { runMigrations } from "./db/migrate.js";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { Matchmaker } from "./game/matchmaker.js";
import type { GameServer } from "./game/types.js";

process.on("unhandledRejection", (err) => {
  logger.fatal({ err }, "Unbehandelte Promise-Ablehnung");
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Unbehandelte Ausnahme");
  process.exit(1);
});

if (env.RUN_MIGRATIONS) await runMigrations();

let matchmaker: Matchmaker | null = null;
const state: AppState = { ready: false, stats: () => matchmaker?.stats ?? {} };

const httpServer = createServer(createApp(state));
const io: GameServer = new Server(httpServer, {
  cors: { origin: env.CLIENT_ORIGIN, credentials: true },
  // Clients schicken nur kleine Events – große Nachrichten sind Missbrauch.
  maxHttpBufferSize: 10_000,
  // Kurze Verbindungsabbrüche (Mobilfunk) ohne Verlust der Socket-Räume überbrücken.
  connectionStateRecovery: { maxDisconnectionDuration: 30_000, skipMiddlewares: false },
});
matchmaker = new Matchmaker(io);
matchmaker.attach();

httpServer.listen(env.PORT, () => {
  state.ready = true;
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "Server gestartet");
});

let draining: Promise<void> | null = null;
/** Keine neuen Duelle mehr, laufende zu Ende spielen. Mehrfach aufrufbar. */
function drain(reason: string): Promise<void> {
  if (!draining) {
    state.ready = false;
    logger.info({ reason, ...matchmaker?.stats }, "Drain gestartet – laufende Duelle werden beendet");
    draining = matchmaker?.drain(env.SHUTDOWN_TIMEOUT_MS) ?? Promise.resolve();
  }
  return draining;
}

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  await drain(signal);
  // Offene Keep-Alive- und WebSocket-Verbindungen sofort trennen, sonst wartet close() auf sie.
  httpServer.closeAllConnections();
  await io.close();
  await pool.end().catch(() => undefined);
  logger.info("Heruntergefahren");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

/**
 * Auf ECS schickt der Load Balancer erst nach der Deregistrierung (Deregistration Delay) ein
 * SIGTERM – und trennt dann alle Verbindungen. Damit in dieser Zeit keine neuen Duelle mehr
 * starten, wird schon gedraint, sobald ECS die Task zum Stoppen markiert.
 */
const ecsMetadata = process.env.ECS_CONTAINER_METADATA_URI_V4;
if (ecsMetadata) {
  const poll = setInterval(async () => {
    try {
      const res = await fetch(`${ecsMetadata}/task`, { signal: AbortSignal.timeout(2000) });
      const task = (await res.json()) as { DesiredStatus?: string };
      if (task.DesiredStatus === "STOPPED") {
        clearInterval(poll);
        void drain("ECS-Task wird gestoppt");
      }
    } catch (err) {
      logger.debug({ err }, "ECS-Metadaten nicht abrufbar");
    }
  }, 5000);
  poll.unref();
}
