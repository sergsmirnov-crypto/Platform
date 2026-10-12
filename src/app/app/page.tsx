import { ClubChecklistBlock } from './_components/dashboard/club-checklist-block'
import { ClubFeedBlock } from './_components/dashboard/club-feed-block'
import { ContinueBlock } from './_components/dashboard/continue-block'
import { GreetingBlock } from './_components/dashboard/greeting-block'
import { NextStreamBlock } from './_components/dashboard/next-stream-block'
import { SubscriptionBlock } from './_components/dashboard/subscription-block'
import { TelegramBlock } from './_components/dashboard/telegram-block'
import { getViewer } from './_lib/viewer'

export const metadata = { title: 'Главная' }

/**
 * Главная страница.
 *
 * ─────────────────────────────────────────────────────────────────
 * УСТРОЕНА КАК СПИСОК НЕЗАВИСИМЫХ БЛОКОВ.
 * Каждый блок — отдельный файл, сам берёт свои данные и сам решает,
 * показываться ли: если данных нет, возвращает пустоту.
 * ─────────────────────────────────────────────────────────────────
 *
 * Поэтому добавить блок — это создать файл и вписать сюда строку,
 * а не переделать страницу. Так появился «Продолжить» на шаге 6.3
 * и «Ближайший эфир» на шаге 7.2: страница не менялась, добавлялась
 * одна строка. Так же появятся подборка недели и ленты новинок.
 *
 * Сейчас блоков семь — те, для которых уже есть данные. Собирать
 * остальные на выдуманных числах не стали: их пришлось бы переписывать
 * дважды, а участник всё равно увидел бы пустые полки (PRD v0.1 §1.3,
 * принцип «всегда есть что открыть» начинает работать с появлением
 * содержимого, а не разметки).
 *
 * Временный блок «Платформа наполняется» снят: разделы, о которых он
 * предупреждал, давно открыты (ADR-0032).
 *
 * Хлебных крошек здесь нет намеренно: вести с главной на главную незачем.
 * Поэтому и `PageIntro` не используется — приветствие само является
 * заголовком страницы.
 */
export default async function DashboardPage() {
  const viewer = await getViewer()

  if (!viewer.session) return null

  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <GreetingBlock displayName={viewer.session.user.displayName} />

      {/* «Продолжить» стоит выше состояния подписки намеренно: у человека
          с действующей подпиской блока подписки нет вовсе, а у того, чья
          подписка кончается, продолжить занятие — по-прежнему первое,
          зачем он пришёл */}
      <ContinueBlock />

      {/* Эфир — единственное, что нельзя посмотреть позже, поэтому
          он идёт сразу за «Продолжить». Блока нет вовсе, если
          ближайших эфиров не назначено */}
      <NextStreamBlock />

      {/* Новости клуба — бывшая главная ветка чата: закреплённый анонс
          и свежие посты. После эфира: анонс эфира важнее любого поста */}
      <ClubFeedBlock />

      <SubscriptionBlock userId={viewer.session.user.id} />

      {/* Список освоения — ниже подписки и эфира, но выше чатов: он важен
          только первые недели, а два блока над ним нужны всегда. Сам блок
          исчезает, когда всё выполнено или человек его скрыл */}
      <ClubChecklistBlock userId={viewer.session.user.id} />

      <TelegramBlock />
    </div>
  )
}
