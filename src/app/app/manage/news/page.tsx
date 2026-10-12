import Link from 'next/link'

import { newsStrings } from '@/modules/news'
import { listNewsForManage } from '@/modules/news/service'
import { routes } from '@/shared/routes'
import { Badge, EmptyState } from '@/ui'

import { PageIntro } from '../../_components/page-intro'
import { requireManagePermission } from '../../_lib/guards'

import { CreateNewsButton } from './_components/create-news-button'

export const metadata = { title: newsStrings.manage.title }

/**
 * Список новостей в управлении.
 *
 * Все статусы вместе, свежие правки сверху: куратор приходит сюда
 * дописать начатое, а не искать опубликованное — опубликованное он
 * смотрит на самой платформе.
 */
export default async function ManageNewsPage() {
  await requireManagePermission('news.edit')

  const rows = await listNewsForManage()

  return (
    <>
      <PageIntro
        title={newsStrings.manage.title}
        description={newsStrings.manage.description}
        actions={<CreateNewsButton />}
      />

      {rows.length > 0 ? (
        <ul className="border-border divide-border divide-y overflow-hidden rounded-xl border">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={routes.app.manage.newsPost(row.id)}
                className="hover:bg-surface-hover flex items-center gap-3 p-4 transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {row.title || newsStrings.manage.noTitle}
                  </span>
                  <span className="text-content-muted block text-sm">
                    {newsStrings.kinds[row.kind]} · {row.authorName ?? newsStrings.unknownAuthor}
                  </span>
                </span>

                {row.isPinned ? (
                  <Badge variant="outline" size="sm">
                    {newsStrings.pinned}
                  </Badge>
                ) : null}

                <Badge variant={row.status === 'published' ? 'outline' : 'draft'} size="sm">
                  {row.status === 'published' ? 'Опубликована' : newsStrings.draft}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={newsStrings.manage.empty}
          description={newsStrings.manage.emptyHint}
          className="border-border rounded-lg border border-dashed"
        />
      )}
    </>
  )
}
