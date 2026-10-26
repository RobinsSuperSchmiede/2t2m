import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().default("postgres://duel:duel@localhost:5432/duel"),
  GOOGLE_CLIENT_ID: z.string().optional().transform((v) => v || undefined),
  JWT_SECRET: z.string().min(16, "JWT_SECRET muss mindestens 16 Zeichen lang sein"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  /** Öffentliche URL der App (für Stripe-Weiterleitungen). Standard: CLIENT_ORIGIN. */
  APP_URL: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional().transform((v) => v || undefined),
  STRIPE_WEBHOOK_SECRET: z.string().optional().transform((v) => v || undefined),
  /** Optional: vorhandener Stripe-Preis. Ohne Angabe wird 3 €/Monat direkt im Checkout angelegt. */
  STRIPE_PRICE_ID: z.string().optional().transform((v) => v || undefined),
  DEV_LOGIN: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Ungültige Umgebungsvariablen:", z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === "production",
  devLogin: parsed.data.DEV_LOGIN && parsed.data.NODE_ENV !== "production",
  appUrl: (parsed.data.APP_URL ?? parsed.data.CLIENT_ORIGIN).replace(/\/$/, ""),
};
