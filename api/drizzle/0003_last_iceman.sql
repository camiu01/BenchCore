ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'reader';--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "user_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_normalized_idx" ON "users" USING btree (lower("email"));