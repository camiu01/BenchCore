CREATE TABLE "administrator_totp" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"sealed_secret" text NOT NULL,
	"last_step" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"actor_id" uuid,
	"target_id" uuid,
	"count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "administrator_totp" ADD CONSTRAINT "administrator_totp_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "security_events_created_idx" ON "security_events" USING btree ("created_at","id");