-- Блокировка участника (шаг 9.1)
--
-- Блокировка — это не отсутствие подписки. Подписка отвечает на вопрос
-- «оплачено ли», блокировка — «пускать ли вообще». Вышедший из платного
-- канала теряет доступ к урокам, но остаётся участником клуба; заблокированный
-- не попадает на платформу вовсе.
--
-- Причина хранится рядом с датой: через полгода «а почему он заблокирован»
-- — вопрос без ответа, если причину не спросили в момент действия.
--
-- Ссылка «кто заблокировал» — на ту же таблицу, с обнулением при удалении
-- аккаунта администратора: причина и дата от этого не теряются.

ALTER TABLE "users" ADD COLUMN "blocked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "blocked_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "blocked_by" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_blocked_by_users_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;