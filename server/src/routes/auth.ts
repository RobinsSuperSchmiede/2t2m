import { Router } from "express";
import { z } from "zod";
import type { AuthConfigResponse } from "@2t2m/shared";
import { toUser } from "../account.js";
import { clearSessionCookie, loginDev, loginWithGoogle, requireAuth, setSessionCookie } from "../auth.js";
import { env } from "../env.js";

export const authRouter = Router();

authRouter.get("/config", (_req, res) => {
  const body: AuthConfigResponse = {
    googleClientId: env.GOOGLE_CLIENT_ID ?? null,
    devLogin: env.devLogin,
    stripeEnabled: Boolean(env.STRIPE_SECRET_KEY),
  };
  res.json(body);
});

authRouter.post("/google", async (req, res) => {
  const parsed = z.object({ credential: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "missing_credential" });
    return;
  }
  try {
    const user = await loginWithGoogle(parsed.data.credential);
    setSessionCookie(res, user.id);
    res.json(toUser(user));
  } catch (err) {
    console.warn("Google-Login fehlgeschlagen:", err instanceof Error ? err.message : err);
    res.status(401).json({ error: "google_failed" });
  }
});

authRouter.post("/dev", async (req, res) => {
  if (!env.devLogin) {
    res.status(404).end();
    return;
  }
  const parsed = z.object({ name: z.string().trim().min(2).max(24) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_name" });
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
