ALTER TABLE "users" ADD COLUMN "last_game_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_period_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id");