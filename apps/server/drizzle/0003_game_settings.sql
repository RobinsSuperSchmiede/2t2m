ALTER TABLE "matches" ADD COLUMN "duration_sec" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "questions" text DEFAULT 'mixed' NOT NULL;