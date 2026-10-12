import { MessageCircle } from 'lucide-react'
import { notFound } from 'next/navigation'

import { newsStrings } from '@/modules/news'
import { getNewsBySlug } from '@/modules/news/service'
import { EMPTY_SUMMARY } from '@/modules/reactions'
import { getReactionSummaries } from '@/modules/reactions/service'
import { getSetting, SETTING_KEYS } from '@/modules/settings'
import type { TelegramChatLink } from '@/modules/settings'
import { getSongsByIds } from '@/modules/songs/service'
import { collectSongIds } from '@/shared/blocks'
import { routes } from '@/shared/routes'
import { Badge, LinkButton } from '@/ui'

import { ContentBlocksView } from '../../../_components/content-blocks'
import { PageIntro } from '../../../_components/page-intro'
import { ReactionBar } from '../../../_components/reactions/reaction-bar'
import { getContentViewer } from '../../../_lib/viewer'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const { slug } = await params

  return { title: `${newsStrings.title}: ${slug}` }
}

/**
 * Новость целиком.
 *
 * Содержимое отрисовывается тем же компонентом, что и конспект урока:
 * формат один на всю платформу, и новость, набранная куратором,
 * выглядит так же, как урок, набранный им же.
 *
 * Разборы, упомянутые в новости, подгружаются слоем приложения:
 * модулю новостей запрещено обращаться к модулю разборов напрямую.
 * Так же — реакции и ссылка на чат: модули друг о друге не знают.
 *
 * «Обсудить в чате» ведёт на сообщение, которое указал куратор, а если
 * не указал — в первый чат из настроек: обсуждение остаётся в Telegram
 * (ADR-0032), платформа лишь показывает, куда идти.
 */
export default async function NewsPostPage({ params }: Props) {
  const viewer = await getContentViewer('news.edit')
  if (!viewer) return null

  const { slug } = await params
  const post = await getNewsBySlug(viewer, slug)

  // Новости нет либо она ещё не опубликована для этого человека.
  // Разницу наружу не показываем: она сообщила бы, что черновик с таким
  // адресом существует
  if (!post) notFound()

  const [songs, reactions, chats] = await Promise.all([
    getSongsByIds(viewer, collectSongIds(post.content)),
    getReactionSummaries('news_post', [post.id], viewer.userId),
    getSetting<TelegramChatLink[]>(SETTING_KEYS.telegramChats),
  ])

  const discussionUrl = post.discussionUrl ?? chats[0]?.url ?? null

  return (
    <>
      <PageIntro title={post.title} />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant="outline" size="sm">
          {newsStrings.kinds[post.kind]}
        </Badge>
        {post.isPinned ? (
          <Badge variant="outline" size="sm">
            {newsStrings.pinned}
          </Badge>
        ) : null}
        {post.isDraft ? (
          <Badge variant="draft" size="sm">
            {newsStrings.draft}
          </Badge>
        ) : null}
        <span className="text-content-muted text-sm">
          {post.publishedAt
            ? new Intl.DateTimeFormat('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(post.publishedAt)
            : ''}
          {post.authorName ? ` · ${post.authorName}` : ''}
        </span>
      </div>

      <ContentBlocksView blocks={post.content} songs={songs} />

      {/* Реакции — только у опубликованного: черновик видит один куратор,
          и счётчик под ним ничего не значит */}
      {!post.isDraft ? (
        <div className="border-border mt-10 flex flex-wrap items-start justify-between gap-4 border-t pt-6">
          <ReactionBar
            targetType="news_post"
            targetId={post.id}
            initial={reactions[post.id] ?? EMPTY_SUMMARY}
          />

          {discussionUrl ? (
            <a
              href={discussionUrl}
              target="_blank"
              rel="noreferrer"
              title={newsStrings.discussHint}
              className="border-border hover:border-border-strong inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors"
            >
              <MessageCircle size={16} aria-hidden />
              {newsStrings.discuss}
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="mt-12">
        <LinkButton href={routes.app.club.news()} variant="secondary" size="sm">
          {newsStrings.backToList}
        </LinkButton>
      </div>
    </>
  )
}
