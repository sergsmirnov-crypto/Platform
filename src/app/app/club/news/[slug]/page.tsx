import { notFound } from 'next/navigation'

import { newsStrings } from '@/modules/news'
import { getNewsBySlug } from '@/modules/news/service'
import { getSongsByIds } from '@/modules/songs/service'
import { collectSongIds } from '@/shared/blocks'
import { routes } from '@/shared/routes'
import { Badge, LinkButton } from '@/ui'

import { ContentBlocksView } from '../../../_components/content-blocks'
import { PageIntro } from '../../../_components/page-intro'
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

  const songs = await getSongsByIds(viewer, collectSongIds(post.content))

  return (
    <>
      <PageIntro title={post.title} />

      <div className="mb-6 flex flex-wrap items-center gap-2">
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

      <div className="mt-12">
        <LinkButton href={routes.app.club.news()} variant="secondary" size="sm">
          {newsStrings.backToList}
        </LinkButton>
      </div>
    </>
  )
}
