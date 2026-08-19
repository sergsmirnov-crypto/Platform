import Link from 'next/link'
import { notFound } from 'next/navigation'

import { clubStrings } from '@/modules/club'
import { getMembersDirectory } from '@/modules/club/members-service'
import { findProfileVisibility } from '@/modules/identity'
import { routes } from '@/shared/routes'
import { Avatar, Badge, EmptyState, LinkButton, PillLink } from '@/ui'

import { PageIntro } from '../../_components/page-intro'
import { getViewer } from '../../_lib/viewer'

import { MembersSearch } from './_components/members-search'

export const metadata = { title: 'Участники' }

/**
 * Список участников.
 *
 * ─────────────────────────────────────────────────────────────────
 * ГОРОДА ВМЕСТО КАРТЫ С ТОЧКАМИ
 *
 * В брифе была «карта участников». Точки по адресам в клубе на сто
 * пятьдесят человек создают риск, несопоставимый с пользой: карта
 * показывает, где живёт каждый, и убрать это потом уже нельзя —
 * снимки экрана останутся.
 *
 * Список городов даёт то же ощущение «нас много и мы везде» и работает
 * как фильтр: «кто ещё из Казани» — самый частый вопрос к такому
 * списку.
 * ─────────────────────────────────────────────────────────────────
 *
 * Закрытый профиль не мешает смотреть чужие открытые: решение владельца
 * продукта. Взаимность выглядела бы справедливее, но на деле означала бы
 * давление — чтобы посмотреть, кто в клубе, пришлось бы раскрыться.
 */

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function MembersPage({ searchParams }: Props) {
  const viewer = await getViewer()
  if (!viewer.userId) return null

  const params = await searchParams
  const query = single(params.q)
  const city = single(params.city)

  const [directory, ownVisibility] = await Promise.all([
    getMembersDirectory(viewer.userId, { query, city }),
    findProfileVisibility(viewer.userId),
  ])

  // Пусто означает «нет активной подписки»: визитки — часть закрытой
  // платформы ровно так же, как уроки
  if (!directory) notFound()

  return (
    <>
      <PageIntro
        title={clubStrings.members.title}
        description={clubStrings.members.description}
        actions={
          ownVisibility === 'private' ? (
            <LinkButton href={routes.app.me.settings()} variant="secondary" size="sm">
              {clubStrings.visibility.open}
            </LinkButton>
          ) : undefined
        }
      />

      {/* Предложение открыть визитку — не укор, а объяснение: человек
          видит список, но сам в нём отсутствует, и это стоит пояснить */}
      {ownVisibility === 'private' ? (
        <p className="border-border text-content-muted mb-6 rounded-lg border border-dashed px-4 py-3 text-sm">
          {clubStrings.visibility.private}. {clubStrings.visibility.invite}
        </p>
      ) : null}

      <MembersSearch query={query} total={directory.total} />

      {directory.cities.length > 0 ? (
        <ul className="mb-8 flex flex-wrap gap-2">
          <li>
            <PillLink href={routes.app.club.members()} active={!city} size="sm">
              {clubStrings.members.allCities}
            </PillLink>
          </li>
          {directory.cities.map((item) => (
            <li key={item.city}>
              <PillLink
                href={`${routes.app.club.members()}?city=${encodeURIComponent(item.city)}`}
                active={city === item.city}
                size="sm"
              >
                {item.city} · {item.count}
              </PillLink>
            </li>
          ))}
        </ul>
      ) : null}

      {directory.members.length === 0 ? (
        <EmptyState
          title={query || city ? clubStrings.members.notFound : clubStrings.members.empty}
          description={
            query || city ? clubStrings.members.notFoundHint : clubStrings.members.emptyHint
          }
          className="border-border rounded-lg border border-dashed"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {directory.members.map((member) => (
            <li key={member.userId}>
              <Link
                href={routes.app.club.member(member.userId)}
                className="group border-border bg-surface-raised hover:border-border-strong flex min-h-20 items-center gap-3 rounded-xl border p-4 transition-colors"
              >
                <Avatar src={member.avatarUrl} alt={member.displayName} size="md" />

                <span className="min-w-0 flex-1">
                  <span className="group-hover:text-accent-hover block truncate font-medium transition-colors">
                    {member.displayName}
                    {member.userId === viewer.userId ? (
                      <span className="text-content-subtle"> · это вы</span>
                    ) : null}
                  </span>

                  <span className="text-content-muted block truncate text-sm">
                    {[
                      member.city,
                      member.playingYears ? clubStrings.members.playing(member.playingYears) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>

                {member.curatorSlug ? (
                  <Badge variant="outline" size="sm">
                    Куратор
                  </Badge>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function single(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value

  return first?.trim() || null
}
