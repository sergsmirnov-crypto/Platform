import { filterByTab, libraryStrings, parseFavoriteTab } from '@/modules/library'
import { routes } from '@/shared/routes'
import { EmptyState, LinkButton } from '@/ui'

import { PageIntro } from '../../_components/page-intro'
import { findLibraryCards, getLibraryViewers } from '../../_lib/library'

import { FavoritesList } from './_components/favorites-list'
import { FavoritesTabs } from './_components/favorites-tabs'

export const metadata = { title: libraryStrings.title }

/**
 * Отложенное.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЧЕМ ЭТА СТРАНИЦА ОТЛИЧАЕТСЯ ОТ «МОЕГО ПРОГРЕССА»
 *
 * Прогресс отвечает на вопрос «что я начал». Отложенное — на вопрос
 * «что я выбрал, но ещё не начинал». Это разные списки, и человек
 * приходит за ними в разном настроении: в прогресс — продолжать,
 * сюда — выбирать, чем заняться сегодня вечером.
 *
 * Поэтому здесь нет ни процентов, ни колец прохождения: они отвечали бы
 * на первый вопрос на странице, заданной вторым.
 * ─────────────────────────────────────────────────────────────────
 */

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function FavoritesPage({ searchParams }: Props) {
  const viewers = await getLibraryViewers()
  if (!viewers) return null

  const [query, cards] = await Promise.all([searchParams, findLibraryCards(viewers)])

  const tab = parseFavoriteTab(query.tab)
  const visible = filterByTab(cards, tab)

  return (
    <>
      <PageIntro
        title={libraryStrings.title}
        description={libraryStrings.description}
        actions={
          cards.length > 0 ? (
            <span className="text-content-muted text-sm">{libraryStrings.count(cards.length)}</span>
          ) : undefined
        }
      />

      {cards.length === 0 ? (
        <EmptyState
          title={libraryStrings.empty.title}
          description={libraryStrings.empty.description}
          action={
            <LinkButton href={routes.app.learn.songs()}>{libraryStrings.empty.action}</LinkButton>
          }
          className="border-border mt-8 rounded-lg border border-dashed"
        />
      ) : (
        <>
          <FavoritesTabs rows={cards} current={tab} />

          {visible.length > 0 ? (
            <FavoritesList cards={visible} />
          ) : (
            <EmptyState
              title={libraryStrings.emptyTab.title}
              description={libraryStrings.emptyTab.description}
              className="border-border rounded-lg border border-dashed"
            />
          )}
        </>
      )}
    </>
  )
}
