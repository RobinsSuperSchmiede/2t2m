import type { NextFunction, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { parseCookie } from "cookie";
import { eq } from "drizzle-orm";
import { db, schema } from "./db/index.js";
import type { UserRow } from "./db/schema.js";
import { env } from "./env.js";

export const SESSION_COOKIE = "duel_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const googleClient = new OAuth2Client();

interface SessionPayload {
  sub: string;
}

export function signSession(userId: string): string {
  return jwt.sign({ sub: userId } satisfies SessionPayload, env.JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS });
}

export function verifySession(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as SessionPayload;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, userId: string) {
  res.cookie(SESSION_COOKIE, signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function userIdFromCookieHeader(header: string | undefined): string | null {
  if (!header) return null;
  return verifySession(parseCookie(header)[SESSION_COOKIE]);
}

/** Prüft das von Google Identity Services gelieferte ID-Token und legt den Nutzer an bzw. aktualisiert ihn. */
export async function loginWithGoogle(credential: string): Promise<UserRow> {
  if (!env.GOOGLE_CLIENT_ID) throw new Error("GOOGLE_CLIENT_ID ist nicht konfiguriert");
  const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) throw new Error("Ungültiges Google-Token");
  if (payload.email_verified === false) throw new Error("E-Mail-Adresse ist nicht verifiziert");

  const name = payload.name ?? payload.email.split("@")[0]!;
  const [user] = await db
    .insert(schema.users)
    .values({ googleId: payload.sub, email: payload.email, name, avatarUrl: payload.picture ?? null })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: { googleId: payload.sub, name, avatarUrl: payload.picture ?? null, lastSeenAt: new Date() },
    })
    .returning();
  return user!;
}

/** Nur für die lokale Entwicklung: Login mit beliebigem Namen, um Duelle in zwei Fenstern zu testen. */
export async function loginDev(name: string): Promise<UserRow> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "spieler";
  const email = `${slug}@dev.local`;
  const [user] = await db
    .insert(schema.users)
    .values({ email, name, avatarUrl: null })
    .onConflictDoUpdate({ target: schema.users.email, set: { lastSeenAt: new Date() } })
    .returning();
  return user!;
}

export async function findUser(id: string): Promise<UserRow | undefined> {
  return db.query.users.findFirst({ where: eq(schema.users.id, id) });
}

declare module "express-serve-static-core" {
  interface Request {
    user?: UserRow;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = verifySession(req.cookies?.[SESSION_COOKIE]);
  const user = userId ? await findUser(userId) : undefined;
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  req.user = user;
  next();
}
