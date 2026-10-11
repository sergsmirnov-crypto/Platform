import { notFound } from 'next/navigation'

import { directoryStrings, yearsPlayingLabel } from '@/modules/identity'
import { getMemberDetails } from '@/modules/identity/directory'
import { getSubscriptionHistory, subscriptionStrings } from '@/modules/subscription'
import { routes } from '@/shared/routes'
import { LinkButton, PropertyList } from '@/ui'

import { PageIntro } from '../../../_components/page-intro'
import { requireManagePermission } from '../../../_lib/guards'
import { getViewer, viewerCan } from '../../../_lib/viewer'
import { BlockPanel } from '../_components/block-panel'
import { MemberSummaryCard } from '../_components/member-summary'
import { SubscriptionHistory } from '../_components/subscription-history'
import { SubscriptionPanel } from '../_components/subscription-panel'

/**
 * Карточка участника.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОТВЕЧАЕТ НА ВОПРОСЫ ПОДДЕРЖКИ, А НЕ РАССКАЗЫВАЕТ О ЧЕЛОВЕКЕ
 *
 * Три раздела соответствуют трём вопросам, с которыми сюда приходят:
 * что с доступом, чем занимался, кто это вообще. Личного здесь ровно
 * столько, сколько человек написал о себе сам, — и ни строчкой больше:
 * заметок к разборам и подробностей прогресса тут нет и не будет.
 *
 * Управление ролями и ручная выдача подписки появятся здесь же
 * на шагах 9.2 и 9.4 — отдельными панелями, рядом с блокировкой.
 * ─────────────────────────────────────────────────────────────────
 */

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props) {
  const viewer = await getViewer()
  if (!viewer.userId || !viewerCan(viewer, 'users.view')) return { title: directoryStrings.title }

  const { id } = await params
  const member = await getMemberDetails(viewer.userId, id)

  return { title: member?.displayName ?? directoryStrings.card.notFound }
}

export default async function MemberPage({ params }: Props) {
  const viewer = await requireManagePermission('users.view')

  const { id } = await params
  const member = await getMemberDetails(viewer.userId, id)
  if (!member) notFound()

  // История подписки — только тем, у кого есть право её видеть:
  // куратор со списком участников в чужие платежи не заглядывает
  const canSeeSubscription = viewerCan(viewer, 'subs.view')
  const history = canSeeSubscription
    ? await getSubscriptionHistory(viewer.userId, member.userId)
    : []

  return (
    <>
      <PageIntro
        title={member.displayName}
        crumbTitles={{ [routes.app.manage.members()]: directoryStrings.title }}
        actions={
          member.isProfilePublic ? (
            <LinkButton href={routes.app.club.member(member.userId)} variant="secondary">
              {directoryStrings.card.profile}
            </LinkButton>
          ) : undefined
        }
      />

      <MemberSummaryCard member={member} />

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="border-border rounded-lg border p-5">
          <h3 className="mb-4 font-medium">{directoryStrings.card.subscription}</h3>

          <PropertyList
            layout="stacked"
            items={[
              { label: 'Состояние', value: subscriptionStrings.status[member.accessStatus] },
              {
                label: 'Источник',
                value: member.accessSource ? subscriptionStrings.source[member.accessSource] : null,
              },
              { label: directoryStrings.card.validUntil, value: formatDate(member.validUntil) },
              { label: directoryStrings.card.graceUntil, value: formatDate(member.graceUntil) },
              {
                label: directoryStrings.card.verifiedAt,
                value: formatDate(member.lastVerifiedAt) ?? directoryStrings.card.never,
              },
            ]}
          />
        </section>

        <section className="border-border rounded-lg border p-5">
          <h3 className="mb-4 font-medium">{directoryStrings.card.activity}</h3>

          <PropertyList
            layout="stacked"
            items={[
              { label: directoryStrings.card.joined, value: formatDate(member.joinedAt) },
              {
                label: directoryStrings.card.lastSeen,
                value: formatDate(member.lastSeenAt) ?? directoryStrings.card.neverSeen,
              },
              { label: directoryStrings.card.lessons, value: String(member.completedLessons) },
              {
                label: directoryStrings.card.arrangements,
                value: String(member.completedArrangements),
              },
              {
                label: 'Знакомство',
                value: member.onboardingDoneAt
                  ? directoryStrings.card.onboardingDone
                  : directoryStrings.card.onboardingSkipped,
              },
            ]}
          />
        </section>

        <section className="border-border rounded-lg border p-5">
          <h3 className="mb-4 font-medium">О себе</h3>

          <PropertyList
            layout="stacked"
            items={[
              { label: 'Стаж', value: yearsPlayingLabel(member.playingSince) },
              { label: 'Любимое', value: member.favoriteArtists.slice(0, 3).join(', ') },
              { label: 'Жанры', value: member.favoriteGenres.slice(0, 3).join(', ') },
              {
                label: 'Визитка',
                value: member.isProfilePublic
                  ? directoryStrings.card.profilePublic
                  : directoryStrings.card.profileHidden,
              },
            ]}
          />

          {member.bio ? (
            <p className="text-content-muted mt-4 text-sm whitespace-pre-line">{member.bio}</p>
          ) : null}
        </section>
      </div>

      {canSeeSubscription ? (
        <section className="border-border mt-6 rounded-lg border p-5">
          <h3 className="mb-4 font-medium">История подписки</h3>
          <SubscriptionHistory events={history} />
        </section>
      ) : null}

      {viewerCan(viewer, 'users.ban') || viewerCan(viewer, 'subs.grant') ? (
        <section className="border-border mt-6 space-y-6 rounded-lg border border-dashed p-5">
          <h3 className="font-medium">Доступ к платформе</h3>

          {viewerCan(viewer, 'subs.grant') ? (
            <SubscriptionPanel
              userId={member.userId}
              hasAccess={member.accessStatus === 'active' || member.accessStatus === 'grace'}
            />
          ) : null}

          {viewerCan(viewer, 'users.ban') ? (
            <BlockPanel userId={member.userId} isBlocked={member.isBlocked} />
          ) : null}
        </section>
      ) : null}
    </>
  )
}

/**
 * Дата или пусто.
 *
 * Пусто, а не «—»: `PropertyList` сам отсеивает незаполненные строки,
 * и прочерк в списке из пяти пунктов занимает место, ничего не сообщая.
 */
function formatDate(date: Date | null): string | null {
  if (!date) return null

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}
