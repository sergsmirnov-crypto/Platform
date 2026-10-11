CREATE TABLE "channel_memberships" (
	"telegram_id" text PRIMARY KEY NOT NULL,
	"is_member" boolean DEFAULT false NOT NULL,
	"last_status" text,
	"last_event_at" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "channel_memberships_is_member_idx" ON "channel_memberships" USING btree ("is_member");