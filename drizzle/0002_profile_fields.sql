ALTER TABLE "users" ADD COLUMN "favorite_artists" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "favorite_genres" text[] DEFAULT '{}' NOT NULL;