import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { billingRouter, stripeWebhookRouter } from "./billing.js";
import { pingDatabase } from "./db/index.js";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { authRouter } from "./routes/auth.js";
import { practiceRouter } from "./routes/practice.js";
import { publicStatsRouter, statsRouter } from "./routes/stats.js";

export interface AppState {
  /** false, sobald der Server herunterfährt – der Load Balancer schickt dann keine neuen Anfragen mehr. */
  ready: boolean;
  stats: () => Record<string, unknown>;
}

const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/dist");

export function createApp(state: AppState) {
  const app = express();
  app.disable("x-powered-by");
  // Genau ein Proxy davor (Load Balancer) – nötig für korrekte Client-IPs und sichere Cookies.
  app.set("trust proxy", 1);

  app.use(
    helmet({
      // CSP würde Google-Login, AdSense und Stripe-Weiterleitungen einschränken; bewusst aus.
      contentSecurityPolicy: false,
      // Google-Login öffnet ein Popup, das mit der Seite kommunizieren muss.
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      // Google Identity Services braucht den Origin im Referrer.
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );
  app.use(compression());
  app.use(
    pinoHttp({
      logger,
      // Health-Checks des Load Balancers nicht mitloggen.
      autoLogging: { ignore: (req) => req.url?.startsWith("/api/health") ?? false },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
      // Nur das Nötigste pro Anfrage – volle Header blähen die Logs auf.
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));

  /** Liveness: Prozess läuft. */
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  /** Readiness: Datenbank erreichbar und kein Shutdown im Gange. */
  app.get("/api/health/ready", async (_req, res) => {
    const database = await pingDatabase();
    const ok = state.ready && database;
    res.status(ok ? 200 : 503).json({ ok, database, ...state.stats() });
  });

  // Webhook braucht den unveränderten Body für die Signaturprüfung – daher vor express.json().
  app.use("/api/stripe/webhook", stripeWebhookRouter);
  app.use(express.json({ limit: "16kb" }));
  app.use(cookieParser());

  const limit = (windowMs: number, limit: number) =>
    rateLimit({ windowMs, limit, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "rate_limited" } });
  app.use("/api/auth", limit(60_000, 20));
  app.use("/api", limit(60_000, 300));

  app.use("/api/auth", authRouter);
  app.use("/api/billing", billingRouter);
  app.use("/api/practice", practiceRouter);
  app.use("/api", publicStatsRouter);
  app.use("/api", statsRouter);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  // In Produktion liefert der Server den gebauten Client gleich mit aus.
  if (existsSync(clientDist)) {
    // Dateinamen unter /assets enthalten einen Hash und ändern sich bei jedem Build.
    app.use("/assets", express.static(path.join(clientDist, "assets"), { immutable: true, maxAge: "1y" }));
    app.use(express.static(clientDist, { index: false, maxAge: "1h" }));
    app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (err as { status?: number }).status;
    if (status && (status < 500 || status === 503)) {
      res.status(status).json({ error: (err as Error).message });
      return;
    }
    req.log.error({ err }, "Unbehandelter Fehler");
    // Fehler der Stripe-API (z. B. ungültiger Schlüssel, Netzwerk) verständlich weitergeben.
    if (typeof (err as { type?: unknown }).type === "string" && (err as { type: string }).type.startsWith("Stripe")) {
      res.status(502).json({ error: "payment_provider_unavailable" });
      return;
    }
    res.status(500).json({ error: "internal" });
  });

  return app;
}
