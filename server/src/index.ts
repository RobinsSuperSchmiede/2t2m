import { existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { env } from "./env.js";
import { runMigrations } from "./db/migrate.js";
import { Matchmaker } from "./game/matchmaker.js";
import type { GameServer } from "./game/types.js";
import { authRouter } from "./routes/auth.js";
import { publicStatsRouter, statsRouter } from "./routes/stats.js";
import { billingRouter, stripeWebhookRouter } from "./billing.js";

await runMigrations();

const app = express();
app.set("trust proxy", 1);
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
// Webhook braucht den unveränderten Body für die Signaturprüfung – daher vor express.json().
app.use("/api/stripe/webhook", stripeWebhookRouter);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.use("/api/auth", authRouter);
app.use("/api/billing", billingRouter);
app.use("/api", publicStatsRouter);
app.use("/api", statsRouter);

// In Produktion liefert der Server den gebauten Client gleich mit aus.
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = (err as { status?: number }).status;
  if (status && status < 500) {
    res.status(status).json({ error: (err as Error).message });
    return;
  }
  if (status === 503) {
    res.status(503).json({ error: (err as Error).message });
    return;
  }
  console.error(err);
  // Fehler der Stripe-API (z. B. ungültiger Schlüssel, Netzwerk) verständlich weitergeben.
  if (typeof (err as { type?: unknown }).type === "string" && (err as { type: string }).type.startsWith("Stripe")) {
    res.status(502).json({ error: "Der Zahlungsanbieter ist gerade nicht erreichbar. Bitte versuche es später erneut." });
    return;
  }
  res.status(500).json({ error: "Interner Fehler" });
});

const httpServer = createServer(app);
const io: GameServer = new Server(httpServer, {
  cors: { origin: env.CLIENT_ORIGIN, credentials: true },
});
new Matchmaker(io).attach();

httpServer.listen(env.PORT, () => {
  console.log(`Server läuft auf http://localhost:${env.PORT}`);
});
