import express, { Router } from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { toUser, isPro } from "./account.js";
import { requireAuth } from "./auth.js";
import { db, schema } from "./db/index.js";
import type { UserRow } from "./db/schema.js";
import { env } from "./env.js";
import { logger } from "./logger.js";

export const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;

const PRO_PRICE_CENTS = 300;

function requireStripe(): Stripe {
  if (!stripe) throw Object.assign(new Error("payments_not_configured"), { status: 503 });
  return stripe;
}

/** Überträgt den Zustand eines Stripe-Abos auf den Nutzer. */
export async function applySubscription(sub: Stripe.Subscription): Promise<UserRow | undefined> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId = sub.metadata?.userId;
  const periodEnd = sub.items.data[0]?.current_period_end;

  const user =
    (userId ? await db.query.users.findFirst({ where: eq(schema.users.id, userId) }) : undefined) ??
    (await db.query.users.findFirst({ where: eq(schema.users.stripeCustomerId, customerId) }));
  if (!user) {
    logger.warn({ subscriptionId: sub.id }, "Stripe-Abo: kein passender Nutzer gefunden");
    return undefined;
  }
  // Ein älteres, beendetes Abo darf ein neueres aktives nicht überschreiben.
  if (user.stripeSubscriptionId && user.stripeSubscriptionId !== sub.id && isPro(user) && sub.status === "canceled") {
    return user;
  }

  const [updated] = await db
    .update(schema.users)
    .set({
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      subscriptionStatus: sub.status,
      subscriptionPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end || sub.cancel_at !== null,
    })
    .where(eq(schema.users.id, user.id))
    .returning();
  return updated;
}

async function ensureCustomer(client: Stripe, user: UserRow): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await client.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });
  await db.update(schema.users).set({ stripeCustomerId: customer.id }).where(eq(schema.users.id, user.id));
  return customer.id;
}

export const billingRouter = Router();
billingRouter.use(requireAuth);

billingRouter.post("/checkout", async (req, res) => {
  const client = requireStripe();
  const user = req.user!;
  if (isPro(user)) {
    res.status(400).json({ error: "already_pro" });
    return;
  }
  const customer = await ensureCustomer(client, user);
  const session = await client.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: user.id,
    line_items: [
      env.STRIPE_PRICE_ID
        ? { price: env.STRIPE_PRICE_ID, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: PRO_PRICE_CENTS,
              recurring: { interval: "month" },
              product_data: { name: "2T2M Pro" },
            },
          },
    ],
    subscription_data: { metadata: { userId: user.id } },
    allow_promotion_codes: true,
    success_url: `${env.appUrl}/pro?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.appUrl}/pro?checkout=cancel`,
  });
  res.json({ url: session.url });
});

/** Abo direkt nach der Rückkehr vom Checkout abgleichen – unabhängig davon, wann der Webhook ankommt. */
billingRouter.post("/sync", async (req, res) => {
  const client = requireStripe();
  const parsed = z.object({ sessionId: z.string().startsWith("cs_") }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "missing_session" });
    return;
  }
  const session = await client.checkout.sessions.retrieve(parsed.data.sessionId, { expand: ["subscription"] });
  if (session.client_reference_id !== req.user!.id) {
    res.status(403).json({ error: "foreign_payment" });
    return;
  }
  const updated =
    session.subscription && typeof session.subscription !== "string"
      ? await applySubscription(session.subscription)
      : req.user;
  res.json(toUser(updated ?? req.user!));
});

billingRouter.post("/portal", async (req, res) => {
  const client = requireStripe();
  const user = req.user!;
  if (!user.stripeCustomerId) {
    res.status(400).json({ error: "no_subscription" });
    return;
  }
  const portal = await client.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${env.appUrl}/pro`,
  });
  res.json({ url: portal.url });
});

/** Nur lokal: Pro ohne Zahlung umschalten, um Werbung/Limits zu testen. */
billingRouter.post("/dev-toggle", async (req, res) => {
  if (!env.devLogin) {
    res.status(404).end();
    return;
  }
  const user = req.user!;
  const pro = isPro(user);
  const [updated] = await db
    .update(schema.users)
    .set({
      subscriptionStatus: pro ? "canceled" : "active",
      subscriptionPeriodEnd: pro ? new Date() : new Date(Date.now() + 30 * 24 * 3600 * 1000),
      cancelAtPeriodEnd: false,
    })
    .where(eq(schema.users.id, user.id))
    .returning();
  res.json(toUser(updated!));
});

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

/** Muss vor express.json() eingehängt werden, weil Stripe den Roh-Body signiert. */
export const stripeWebhookRouter = Router();
stripeWebhookRouter.post("/", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).end();
    return;
  }
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, req.headers["stripe-signature"] as string, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn({ err }, "Stripe-Webhook mit ungültiger Signatur");
    res.status(400).send("Ungültige Signatur");
    return;
  }

  try {
    if (SUBSCRIPTION_EVENTS.has(event.type)) {
      // Immer den aktuellen Stand holen – Events können in falscher Reihenfolge ankommen.
      const sub = event.data.object as Stripe.Subscription;
      await applySubscription(await stripe.subscriptions.retrieve(sub.id));
    } else if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        await applySubscription(await stripe.subscriptions.retrieve(id));
      }
    }
    res.json({ received: true });
  } catch (err) {
    logger.error({ err, eventType: event.type }, "Stripe-Webhook fehlgeschlagen");
    // 500 → Stripe versucht es später erneut.
    res.status(500).end();
  }
});
