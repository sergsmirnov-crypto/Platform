-- Эфиры (шаг 7.1)
--
-- Одна таблица на анонс и на запись: это один эфир на разных этапах
-- жизни, а не две сущности. Разделение означало бы переносить запись
-- из таблицы в таблицу в момент, когда куратор выложил видео, — вместе
-- с напоминаниями, сохранёнными ссылками и связями с песнями.
--
-- Оглавление вынесено в отдельную таблицу, а не в JSON: по таймкодам
-- нужен переход из плеера, а позже — поиск «в каком эфире разбирали
-- баррэ».
CREATE TYPE "public"."stream_state" AS ENUM('scheduled', 'live', 'recorded', 'cancelled');--> statement-breakpoint
CREATE TABLE "stream_chapters" (
	"id" uuid PRIMARY KEY NOT NULL,
	"stream_id" uuid NOT NULL,
	"title" text NOT NULL,
	"start_sec" integer NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stream_songs" (
	"stream_id" uuid NOT NULL,
	"song_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streams" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"curator_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"state" "stream_state" DEFAULT 'scheduled' NOT NULL,
	"join_url" text,
	"video_asset_id" uuid,
	"cover_asset_id" uuid,
	"status" "publication_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('russian', coalesce(description, '')), 'B')) STORED
);
--> statement-breakpoint
ALTER TABLE "stream_chapters" ADD CONSTRAINT "stream_chapters_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_songs" ADD CONSTRAINT "stream_songs_stream_id_streams_id_fk" FOREIGN KEY ("stream_id") REFERENCES "public"."streams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stream_songs" ADD CONSTRAINT "stream_songs_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streams" ADD CONSTRAINT "streams_curator_id_users_id_fk" FOREIGN KEY ("curator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streams" ADD CONSTRAINT "streams_video_asset_id_media_assets_id_fk" FOREIGN KEY ("video_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streams" ADD CONSTRAINT "streams_cover_asset_id_media_assets_id_fk" FOREIGN KEY ("cover_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streams" ADD CONSTRAINT "streams_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stream_chapters_order_idx" ON "stream_chapters" USING btree ("stream_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "stream_songs_pk" ON "stream_songs" USING btree ("stream_id","song_id");--> statement-breakpoint
CREATE INDEX "stream_songs_song_idx" ON "stream_songs" USING btree ("song_id");--> statement-breakpoint
CREATE UNIQUE INDEX "streams_slug_idx" ON "streams" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "streams_date_idx" ON "streams" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "streams_state_idx" ON "streams" USING btree ("state");--> statement-breakpoint
CREATE INDEX "streams_curator_idx" ON "streams" USING btree ("curator_id");--> statement-breakpoint
CREATE INDEX "streams_search_idx" ON "streams" USING gin ("search_vector");