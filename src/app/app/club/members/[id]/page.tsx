import { clubStrings } from '@/modules/club'
import { getMemberCard } from '@/modules/club/members-service'
import { SOCIAL_NETWORKS } from '@/modules/identity'
import { routes } from '@/shared/routes'
import { Avatar, Badge, LinkButton, PillLink } from '@/ui'

import { PageIntro } from '../../../_components/page-intro'
import { getViewer } from '../../../_lib/viewer'

import type { Metadata } from 'next'

type Props = { params: Promise<{ id: string }> }

export const metadata: Metadata = { title: 'Визитка участника' }

/**
 * Визитка участника.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАКРЫТАЯ ВИЗИТКА — ЭТО НЕ «СТРАНИЦА НЕ НАЙДЕНА»
 *
 * Человек мог отправить ссылку на себя, а потом закрыть визитку;
 * или ссылка сохранилась с прошлого месяца. «Ничего не найдено»
 * заставило бы гадать, сломалась платформа или человек ушёл из клуба.
 *
 * Поэтому здесь прямое объяснение: визитка закрыта, и это его право.
 * Ничего сверх этого не сообщается — ни имени, ни города, ни того,
 * состоит ли человек в клубе вообще.
 * ─────────────────────────────────────────────────────────────────
 */
export default async function MemberPage({ params }: Props) {
  const viewer = await getViewer()
  if (!viewer.userId) return null

  const { id } = await params
  const member = await getMemberCard(viewer.userId, id)

  // Пусто может значить и «нет подписки», и «визитка закрыта».
  // Первое разводится страницей подписки в разметке закрытой зоны,
  // здесь остаётся второе
  if (!member) return <ClosedCard isSelf={id === viewer.userId} />

  const socials = SOCIAL_NETWORKS.filter((network) => member.socials[network.key])

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start gap-6">
        <Avatar src={member.avatarUrl} alt={member.displayName} size="xl" />

        <div className="min-w-0 flex-1">
          <PageIntro
            title={member.displayName}
            actions={
              member.userId === viewer.userId ? (
                <LinkButton href={routes.app.me.profile()} variant="secondary" size="sm">
                  Править профиль
                </LinkButton>
              ) : undefined
            }
          />

          <p className="text-content-muted flex flex-wrap items-center gap-2 text-sm">
            {member.city ? <span>{member.city}</span> : null}

            {member.playingYears ? (
              <span>· {clubStrings.members.playing(member.playingYears)}</span>
            ) : null}

            {member.skillLevel ? (
              <span>· {clubStrings.members.level[member.skillLevel]}</span>
            ) : null}

            {member.curatorSlug ? (
              <Badge variant="outline" size="sm">
                {clubStrings.members.curator}
              </Badge>
            ) : null}
          </p>
        </div>
      </div>

      {member.bio ? (
        <section className="mb-10 max-w-prose">
          <h2 className="text-content-subtle mb-2 text-xs tracking-wide uppercase">
            {clubStrings.members.about}
          </h2>
          <p className="whitespace-pre-line">{member.bio}</p>
        </section>
      ) : null}

      <div className="mb-10 grid gap-6 sm:grid-cols-2">
        <FactList title={clubStrings.members.artists} items={member.favoriteArtists} />
        <FactList title={clubStrings.members.genres} items={member.favoriteGenres} />
      </div>

      {socials.length > 0 ? (
        <ul className="mb-10 flex flex-wrap gap-2">
          {socials.map((network) => (
            <li key={network.key}>
              {/* Внешние ссылки — с защитой от подмены открывшей вкладки */}
              <PillLink
                href={member.socials[network.key] as string}
                target="_blank"
                rel="noopener noreferrer nofollow"
                size="sm"
              >
                {network.label}
              </PillLink>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <PillLink href={routes.app.club.members()}>{clubStrings.members.back}</PillLink>

        {member.curatorSlug ? (
          <PillLink href={routes.app.club.curator(member.curatorSlug)}>
            {clubStrings.members.openCuratorPage}
          </PillLink>
        ) : null}
      </div>
    </>
  )
}

/** Закрытая визитка: объяснение вместо пустоты и без единой подробности */
function ClosedCard({ isSelf }: { isSelf: boolean }) {
  return (
    <>
      <PageIntro
        title={clubStrings.members.closed}
        description={isSelf ? clubStrings.visibility.private : clubStrings.members.closedHint}
      />

      <div className="flex flex-wrap gap-2">
        <PillLink href={routes.app.club.members()}>{clubStrings.members.back}</PillLink>

        {isSelf ? (
          <PillLink href={routes.app.me.settings()}>{clubStrings.visibility.open}</PillLink>
        ) : null}
      </div>
    </>
  )
}

function FactList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null

  return (
    <div>
      <h2 className="text-content-subtle mb-2 text-xs tracking-wide uppercase">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item}>
            <Badge variant="outline" size="sm">
              {item}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  )
}
