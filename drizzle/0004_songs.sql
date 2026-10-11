CREATE TYPE "public"."tag_kind" AS ENUM('genre', 'technique', 'mood');--> statement-breakpoint
CREATE TYPE "public"."content_entity" AS ENUM('song', 'arrangement', 'arrangement_section', 'lesson', 'stream', 'news_post');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('draft', 'scheduled', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_type" "content_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"title" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arrangement_sections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"arrangement_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"video_asset_id" uuid,
	"video_start_sec" integer,
	"video_end_sec" integer,
	"duration_sec" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arrangements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"song_id" uuid NOT NULL,
	"level" "skill_level" NOT NULL,
	"title" text,
	"curator_id" uuid,
	"summary" text,
	"estimated_minutes" integer,
	"video_asset_id" uuid,
	"order_index" integer DEFAULT 0 NOT NULL,
	"status" "publication_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"album" text,
	"year" integer,
	"cover_asset_id" uuid,
	"description" text,
	"tuning" text,
	"capo" integer,
	"tempo_bpm" integer,
	"music_key" text,
	"status" "publication_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"popularity_score" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taggables" (
	"tag_id" uuid NOT NULL,
	"entity_type" "content_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "taggables_tag_id_entity_type_entity_id_pk" PRIMARY KEY("tag_id","entity_type","entity_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" "tag_kind" NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrangement_sections" ADD CONSTRAINT "arrangement_sections_arrangement_id_arrangements_id_fk" FOREIGN KEY ("arrangement_id") REFERENCES "public"."arrangements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrangement_sections" ADD CONSTRAINT "arrangement_sections_video_asset_id_media_assets_id_fk" FOREIGN KEY ("video_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrangements" ADD CONSTRAINT "arrangements_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrangements" ADD CONSTRAINT "arrangements_curator_id_users_id_fk" FOREIGN KEY ("curator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arrangements" ADD CONSTRAINT "arrangements_video_asset_id_media_assets_id_fk" FOREIGN KEY ("video_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_cover_asset_id_media_assets_id_fk" FOREIGN KEY ("cover_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taggables" ADD CONSTRAINT "taggables_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_entity_idx" ON "attachments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "attachments_asset_idx" ON "attachments" USING btree ("media_asset_id");--> statement-breakpoint
CREATE INDEX "arrangement_sections_arrangement_idx" ON "arrangement_sections" USING btree ("arrangement_id");--> statement-breakpoint
CREATE INDEX "arrangements_song_idx" ON "arrangements" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "arrangements_curator_idx" ON "arrangements" USING btree ("curator_id");--> statement-breakpoint
CREATE INDEX "arrangements_level_idx" ON "arrangements" USING btree ("level");--> statement-breakpoint
CREATE UNIQUE INDEX "songs_slug_idx" ON "songs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "songs_status_published_idx" ON "songs" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "songs_artist_idx" ON "songs" USING btree ("artist");--> statement-breakpoint
CREATE INDEX "songs_popularity_idx" ON "songs" USING btree ("popularity_score");--> statement-breakpoint
CREATE INDEX "taggables_entity_idx" ON "taggables" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tags_kind_idx" ON "tags" USING btree ("kind","order_index");