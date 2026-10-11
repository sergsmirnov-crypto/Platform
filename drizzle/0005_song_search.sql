-- Поиск по разборам (шаг 5.7)
--
-- Расширение pg_trgm даёт устойчивость к опечаткам: оно разбивает слова
-- на тройки букв и умеет считать похожесть. «Металика» и «Металлика»
-- совпадают примерно на 85 процентов — этого достаточно.
--
-- ВНИМАНИЕ ПРИ РАЗВЁРТЫВАНИИ: создание расширения требует прав
-- суперпользователя базы. На нашем PostgreSQL в Docker это выполняется
-- само; у стороннего поставщика базы расширение должно быть разрешено.
-- Подробности — OPERATIONS.md §3.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('russian', coalesce(artist, '')), 'B') ||
          setweight(to_tsvector('russian', coalesce(album, '')), 'C') ||
          setweight(to_tsvector('russian', coalesce(description, '')), 'D')) STORED;--> statement-breakpoint
CREATE INDEX "songs_search_idx" ON "songs" USING gin ("search_vector");--> statement-breakpoint
-- Похожесть считается для запроса целиком против «исполнитель — название»:
-- так «металика» находит «Metallica — Nothing Else Matters», а не любую
-- песню, где встретилось похожее слово.
CREATE INDEX "songs_trgm_idx" ON "songs" USING gin ((artist || ' ' || title) gin_trgm_ops);