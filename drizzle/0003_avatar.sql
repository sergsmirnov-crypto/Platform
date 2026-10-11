ALTER TABLE "users" ADD COLUMN "avatar_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "avatar_url";