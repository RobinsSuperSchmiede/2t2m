import { Router } from "express";
import { z } from "zod";
import type { AuthConfigResponse, User } from "@2t2m/shared";
import { clearSessionCookie, loginDev, loginWithGoogle, requireAuth, setSessionCookie } from "../auth.js";
import type { UserRow } from "../db/schema.js";
import { env } from "../env.js";

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt.toISOString(),
  };
}

export const authRouter = Router();

authRouter.get("/config", (_req, res) => {
  const body: AuthConfigResponse = { googleClientId: env.GOOGLE_CLIENT_ID ?? null, devLogin: env.devLogin };
  res.json(body);
});

authRouter.post("/google", async (req, res) => {
  const parsed = z.object({ credential: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "credential fehlt" });
    return;
  }
  try {
    const user = await loginWithGoogle(parsed.data.credential);
    setSessionCookie(res, user.id);
    res.json(toUser(user));
  } catch (err) {
    console.warn("Google-Login fehlgeschlagen:", err instanceof Error ? err.message : err);
    res.status(401).json({ error: "Google-Anmeldung fehlgeschlagen" });
  }
});

authRouter.post("/dev", async (req, res) => {
  if (!env.devLogin) {
    res.status(404).end();
    return;
  }
  const parsed = z.object({ name: z.string().trim().min(2).max(24) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Name muss 2–24 Zeichen lang sein" });
    return;
  }
  const user = await loginDev(parsed.data.name);
  setSessionCookie(res, user.id);
  res.json(toUser(user));
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json(toUser(req.user!));
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});
