import { getEditableSettings } from '@/modules/settings'
import { settingsStrings } from '@/modules/settings/strings'

import { PageIntro } from '../../_components/page-intro'
import { requireManagePermission } from '../../_lib/guards'
import { viewerCan } from '../../_lib/viewer'

import { AboutEditor } from './_components/about-editor'
import { ChatsEditor, RenewUrlEditor } from './_components/simple-editors'

export const metadata = { title: 'Настройки платформы' }

/**
 * Настройки платформы.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЭКРАН СУЩЕСТВУЕТ, ЧТОБЫ НЕ ЗВАТЬ РАЗРАБОТЧИКА
 *
 * Всё, что здесь правится, до сих пор менялось запросом в базу.
 * Это значит, что расписание эфиров на странице «О клубе» отставало
 * от жизни ровно настолько, насколько неудобно было просить о правке.
 *
 * Ничего технического тут нет и быть не должно: ни ключей, ни JSON,
 * ни адресов. Только текст, ссылки и понятные поля.
 * ─────────────────────────────────────────────────────────────────
 */
export default async function PlatformSettingsPage() {
  const viewer = await requireManagePermission('settings.edit')

  const settings = await getEditableSettings()

  return (
    <>
      <PageIntro title={settingsStrings.title} description={settingsStrings.description} />

      <div className="space-y-6">
        <RenewUrlEditor value={settings.renewUrl} />
        <ChatsEditor value={settings.chats} />
        <AboutEditor value={settings.about} />

        {/* Раздел показан пустым нарочно: он объясняет, почему его нет,
            и не даёт завести переключатель для несуществующей возможности */}
        {viewerCan(viewer, 'flags.edit') ? (
          <section className="border-border rounded-lg border border-dashed p-5">
            <h2 className="font-medium">{settingsStrings.flags.title}</h2>
            <p className="text-content-muted mt-1 text-sm">{settingsStrings.flags.empty}</p>
          </section>
        ) : null}
      </div>
    </>
  )
}
