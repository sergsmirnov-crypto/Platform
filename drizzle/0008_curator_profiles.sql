-- Карточки кураторов (шаг 8.1)
--
-- Расширение участника, а не отдельный человек: первичный ключ —
-- идентификатор пользователя. Куратор уже есть в клубе, у него есть
-- профиль, прогресс и подписка; карточка добавляет публичную часть.
--
-- Отдельная таблица, а не поля в users: этих полей десяток, и у ста
-- пятидесяти участников из ста пятидесяти они пустые.
--
-- Карточка скрывается, а не удаляется (is_public): куратор уходит
-- в отпуск, его разборы остаются, связь «кто вёл» никуда не девается.
--
-- Порядок задаётся руками (order_index): кураторы — это люди,
-- и алфавитный порядок здесь не нейтрален, а случаен.
CREATE TABLE "curator_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"headline" text,
	"bio" text,
	"teaches" text[] DEFAULT '{}' NOT NULL,
	"influences" text[] DEFAULT '{}' NOT NULL,
	"gear" text[] DEFAULT '{}' NOT NULL,
	"teaching_since" integer,
	"is_public" boolean DEFAULT false NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "curator_profiles" ADD CONSTRAINT "curator_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "curator_profiles_slug_idx" ON "curator_profiles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "curator_profiles_order_idx" ON "curator_profiles" USING btree ("order_index");