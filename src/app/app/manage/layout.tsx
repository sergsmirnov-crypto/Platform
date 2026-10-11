import { Eye } from 'lucide-react'

import { PreviewToggle } from '../_components/preview-toggle'
import { requireManageAccess } from '../_lib/guards'
import { getViewer } from '../_lib/viewer'

/**
 * Разметка раздела «Управление».
 *
 * Это НЕ отдельная админка: раздел живёт внутри платформы, под тем же
 * входом и той же сессией (PRD v0.3 §1). Отличие только в том, что доступ
 * к нему требует хотя бы одного управляющего права.
 *
 * Два случая обрабатываются по-разному, и это важно:
 *
 * 1. **Режим «смотреть как участник».** Человек права имеет, но сам
 *    попросил их спрятать. Молча увести его на главную — значит оставить
 *    в недоумении: он нажал на закладку, и его куда-то выкинуло.
 *    Показываем объяснение и кнопку возврата.
 *
 * 2. **Прав нет.** Человек попал сюда по прямой ссылке — пункта меню
 *    у него нет. Уводим на главную: объяснять нечего.
 */
export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer()

  if (viewer.isPreview) {
    return (
      <section className="mx-auto max-w-lg px-6 py-16 text-center">
        <span className="bg-accent text-accent-content mx-auto flex h-12 w-12 items-center justify-center rounded-full">
          <Eye size={22} aria-hidden />
        </span>

        <h1 className="mt-4 text-xl font-bold">Управление скрыто</h1>

        <p className="text-content-muted mt-2 text-sm">
          Сейчас вы смотрите платформу глазами обычного участника. Чтобы вернуться к разборам,
          эфирам и настройкам, выключите режим.
        </p>

        <PreviewToggle
          mode="exit"
          className="bg-accent text-accent-content hover:bg-accent-hover mt-6 inline-flex min-h-11 items-center rounded-full px-5 text-sm font-medium"
        >
          Вернуться к управлению
        </PreviewToggle>
      </section>
    )
  }

  await requireManageAccess()

  return <div data-section="manage">{children}</div>
}
