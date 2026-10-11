import { newsStrings } from '@/modules/news'
import { getNewsForEditor } from '@/modules/news/service'

import { PageIntro } from '../../../_components/page-intro'
import { requireManagePermission } from '../../../_lib/guards'
import { getViewer, viewerCan } from '../../../_lib/viewer'

import { NewsForm } from './_form'

type Props = { params: Promise<{ id: string }> }

export const metadata = { title: newsStrings.manage.title }

/**
 * Редактор новости.
 *
 * Кнопки публикации и удаления показываются по правам: у куратора
 * без права публиковать их просто нет — не серых и не заблокированных,
 * а отсутствующих (PRD v0.3 §4.1). Сервер всё равно проверит сам.
 */
export default async function ManageNewsPostPage({ params }: Props) {
  await requireManagePermission('news.edit')

  const [{ id }, viewer] = await Promise.all([params, getViewer()])
  const post = await getNewsForEditor(id)

  return (
    <>
      <PageIntro title={post.title || newsStrings.manage.noTitle} />

      <NewsForm
        id={post.id}
        slug={post.slug}
        initialTitle={post.title}
        initialExcerpt={post.excerpt ?? ''}
        initialPinned={post.isPinned}
        initialContent={post.content}
        isPublished={post.status === 'published'}
        canPublish={viewerCan(viewer, 'news.publish')}
        canDelete={viewerCan(viewer, 'news.delete')}
      />
    </>
  )
}
