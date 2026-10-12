-- Новости клуба как главная ветка чата и реакции (ADR-0032)
--
-- Виды постов (дайджест, анонс, поздравление, новость), срок закрепления
-- и ссылка на обсуждение в Telegram. Существующие посты получают вид
-- «новость», закрепление без срока остаётся как было.
--
-- Реакции: одна от человека на объект — составным ключом.
CREATE TYPE "public"."news_kind" AS ENUM('news', 'digest', 'announcement', 'greeting');--> statement-breakpoint
CREATE TYPE "public"."reaction_target" AS ENUM('news_post');--> statement-breakpoint
CREATE TABLE "reactions" (
	"target_type" "reaction_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_target_type_target_id_user_id_pk" PRIMARY KEY("target_type","target_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "pinned_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "kind" "news_kind" DEFAULT 'news' NOT NULL;--> statement-breakpoint
ALTER TABLE "news_posts" ADD COLUMN "discussion_url" text;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reactions_user_idx" ON "reactions" USING btree ("user_id");