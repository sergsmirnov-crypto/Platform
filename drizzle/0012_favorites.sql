-- Личная библиотека: что человек отложил на потом (шаг 10.1)
--
-- Составной первичный ключ вместо собственного идентификатора: строка
-- полностью определяется тройкой «кто, что, какое». «Отложить дважды» —
-- не событие, а то же самое состояние, и база запрещает вторую вставку
-- сама, не полагаясь на внимательность приложения.
--
-- Внешнего ключа на отложенный объект нет: ссылаться разом на песни,
-- эфиры и уроки средствами базы невозможно. Плата — висящая строка после
-- удаления разбора; она никому не видна, потому что чтение всегда идёт
-- через соединение с самим объектом. Та же развязка, что у `progress`.
--
-- Индекс покрывает единственный запрос страницы: «что я отложил»,
-- свежее сверху.

CREATE TYPE "public"."favorite_entity" AS ENUM('song', 'stream', 'lesson');--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"entity_type" "favorite_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_entity_type_entity_id_pk" PRIMARY KEY("user_id","entity_type","entity_id")
);
--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "favorites_recent_idx" ON "favorites" USING btree ("user_id","created_at" DESC NULLS LAST);