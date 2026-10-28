import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => v || undefined);

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().default(3001),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    DATABASE_URL: optional,
    /**
     * TLS zur Datenbank: "disable" (lokal), "require" (verschlüsselt, Zertifikat ungeprüft) oder
     * "verify" (Zertifikat wird geprüft; eigene CAs wie das RDS-Bundle über NODE_EXTRA_CA_CERTS).
     */
    DATABASE_SSL: z.enum(["disable", "require", "verify"]).default("disable"),
    // Mindestens 2: Die Migration hält eine Verbindung für die Sperre und braucht eine weitere.
    DATABASE_POOL_MAX: z.coerce.number().int().min(2).default(10),
    GOOGLE_CLIENT_ID: optional,
    JWT_SECRET: z.string().min(16, "JWT_SECRET muss mindestens 16 Zeichen lang sein"),
    // Auf Render ohne eigene Domain reicht die automatisch gesetzte RENDER_EXTERNAL_URL.
    CLIENT_ORIGIN: z.string().default(process.env.RENDER_EXTERNAL_URL || "http://localhost:5173"),
    /** Öffentliche URL der App (für Stripe-Weiterleitungen). Standard: CLIENT_ORIGIN. */
    APP_URL: optional,
    STRIPE_SECRET_KEY: optional,
    STRIPE_WEBHOOK_SECRET: optional,
    /** Optional: vorhandener Stripe-Preis. Ohne Angabe wird 3 €/Monat direkt im Checkout angelegt. */
    STRIPE_PRICE_ID: optional,
    DEV_LOGIN: z
      .string()
      .optional()
      .transform((v) => v === "true"),
    /** Migrationen beim Start ausführen (Standard). Auf false setzen, wenn sie ein eigener Deploy-Schritt erledigt. */
    RUN_MIGRATIONS: z
      .string()
      .optional()
      .transform((v) => v !== "false"),
    /** Bot als Gegner, wenn nach kurzer Wartezeit kein Mensch gefunden wird. */
    BOTS_ENABLED: z
      .string()
      .optional()
      .transform((v) => v !== "false"),
    /** Wie lange laufende Duelle beim Herunterfahren noch zu Ende gespielt werden dürfen. */
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(90_000),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV !== "production") return;
    // In Produktion keine stillen Standardwerte für Geheimnisse und Verbindungen.
    if (!v.DATABASE_URL) ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "ist in Produktion Pflicht" });
    if (v.JWT_SECRET.length < 32) {
      ctx.addIssue({ code: "custom", path: ["JWT_SECRET"], message: "muss in Produktion mindestens 32 Zeichen lang sein" });
    }
    if (v.STRIPE_SECRET_KEY && !v.STRIPE_WEBHOOK_SECRET) {
      ctx.addIssue({ code: "custom", path: ["STRIPE_WEBHOOK_SECRET"], message: "ist Pflicht, sobald Stripe aktiv ist" });
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Ungültige Umgebungsvariablen:", z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = {
  ...parsed.data,
  DATABASE_URL: parsed.data.DATABASE_URL ?? "postgres://duel:duel@localhost:5432/duel",
  isProd: parsed.data.NODE_ENV === "production",
  devLogin: parsed.data.DEV_LOGIN && parsed.data.NODE_ENV !== "production",
  appUrl: (parsed.data.APP_URL ?? parsed.data.CLIENT_ORIGIN).replace(/\/$/, ""),
};
