-- Личные настройки доставки уведомлений (шаг 10.3)
--
-- Хранятся только ОТКЛОНЕНИЯ от значения по умолчанию. Строка на каждый
-- тип для каждого человека потребовала бы миграции при появлении нового
-- типа, а забытая вставка означала бы человека, который молча
-- не получает половину уведомлений. Пусто — значит «как задумано».
--
-- Тот же приём, что у персональных исключений в правах (PRD v0.3 §2).
--
-- Таблица `notifications` при этом не создаётся: она существует
-- с Этапа 2 и на этом шаге лишь переехала из схемы модуля `audit`
-- в собственный модуль. Имя и колонки не менялись.

CREATE TABLE "notification_preferences" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"enabled" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_type_pk" PRIMARY KEY("user_id","type")
);
--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;