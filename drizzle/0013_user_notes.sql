-- Личные заметки с привязкой к моменту ролика (шаг 10.2)
--
-- Заметка всегда личная: поля «видна всем» нет и не будет. Смысл заметки
-- в том, что человек пишет её для себя и в тех выражениях, в каких думает;
-- стоит появиться зрителям — и писать перестают. Обсуждение разбора
-- у платформы своё место имеет, это другая сущность.
--
-- `timecode_sec` необязателен: половина заметок про запись вообще
-- («вернуться, когда выучу баррэ»), и требовать для них время значило бы
-- заставлять человека выдумывать его.
--
-- Внешнего ключа на объект нет — та же развязка, что у `favorites`
-- и `progress`: сослаться разом на три таблицы средствами базы нельзя.
--
-- Два индекса на два разных вопроса: «заметки этого разбора» (страница
-- содержимого) и «все мои заметки, свежие сверху» (страница заметок).

CREATE TYPE "public"."note_entity" AS ENUM('arrangement', 'lesson', 'stream');--> statement-breakpoint
CREATE TABLE "user_notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_type" "note_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"body" text NOT NULL,
	"timecode_sec" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_notes" ADD CONSTRAINT "user_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_notes_entity_idx" ON "user_notes" USING btree ("user_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "user_notes_recent_idx" ON "user_notes" USING btree ("user_id","updated_at" DESC NULLS LAST);