-- Подписки в Toolsy — второй источник сведений об оплате (ADR-0031)
--
-- Toolsy сообщает об оплатах напрямую, в обход Telegram. Факты хранятся
-- по подписке и идентификатору Telegram, а не по участнику платформы:
-- человек мог оплатить, ещё не подключив Telegram к аккаунту.
--
-- Новое значение источника доступа только добавляется: существующие
-- записи не меняются, обратная совместимость сохраняется.
ALTER TYPE "public"."entitlement_source" ADD VALUE 'toolsy';--> statement-breakpoint
CREATE TABLE "toolsy_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"telegram_id" text NOT NULL,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone,
	"product_id" text,
	"source_updated_at" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "toolsy_subscriptions_telegram_idx" ON "toolsy_subscriptions" USING btree ("telegram_id");--> statement-breakpoint
CREATE INDEX "toolsy_subscriptions_status_idx" ON "toolsy_subscriptions" USING btree ("status");