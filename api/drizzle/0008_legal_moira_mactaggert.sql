CREATE TABLE "newsletter_campaigns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_deliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"subscriber_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "consented_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "confirm_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscribers" ADD COLUMN "requested_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "newsletter_deliveries" ADD CONSTRAINT "newsletter_deliveries_campaign_id_newsletter_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."newsletter_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_delivery_recipient_idx" ON "newsletter_deliveries" USING btree ("campaign_id","subscriber_id");--> statement-breakpoint
CREATE INDEX "newsletter_delivery_queue_idx" ON "newsletter_deliveries" USING btree ("campaign_id","status");