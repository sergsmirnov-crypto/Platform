import { findProfile } from '@/modules/identity'
import { getSession } from '@/modules/identity/current-user'

import { PageIntro } from '../../_components/page-intro'
import { AvatarCard } from '../_components/avatar-card'
import { ProfileForm } from '../_components/profile-form'

export const metadata = { title: 'Профиль' }

/**
 * Страница профиля.
 *
 * Данные читаются на сервере и отдаются форме готовыми. Фотография вынесена
 * в отдельную карточку над формой: она сохраняется сразу и не должна
 * теряться, если человек передумает сохранять остальное.
 */
export default async function ProfilePage() {
  const session = await getSession()
  if (!session) return null

  const profile = await findProfile(session.user.id)
  if (!profile) return null

  return (
    <>
      <PageIntro title="Профиль" description="Эти сведения увидят другие участники клуба" />

      <AvatarCard avatarUrl={profile.avatarUrl} displayName={profile.displayName} />

      <ProfileForm profile={profile} />
    </>
  )
}
