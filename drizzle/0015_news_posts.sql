-- Новости клуба (шаг 10.7)
--
-- Содержимое хранится тем же блочным форматом, что у уроков: свой формат
-- для новостей означал бы второй редактор, второй отрисовщик и два разных
-- набора возможностей у людей, пишущих в одном и том же клубе.
--
-- `excerpt` отдельным полем, а не первым абзацем содержимого: первый абзац
-- часто начинается с «Друзья, привет!», и список из десяти таких приветствий
-- не сообщает ничего.
--
-- Индекс по (is_pinned, published_at) покрывает единственный порядок ленты:
-- закреплённые сверху, дальше по дате. Поисковый вектор — по названию
-- и выжимке; содержимое лежит в JSON, и вытаскивать из него текст выражением
-- вычисляемой колонки значило бы получить неотлаживаемое выражение.

CREATE TABLE "news_posts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"content" jsonb,
	"author_id" uuid,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"status" "publication_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('russian', coalesce(excerpt, '')), 'B')) STORED
);
--> statement-breakpoint
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "news_posts_slug_idx" ON "news_posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "news_posts_published_idx" ON "news_posts" USING btree ("is_pinned","published_at");--> statement-breakpoint
CREATE INDEX "news_posts_search_idx" ON "news_posts" USING gin ("search_vector");