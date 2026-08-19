import { Check } from 'lucide-react'

import { CHECKLIST_TOTAL } from '@/modules/identity/checklist'
import type { ChecklistItem, ChecklistItemKey } from '@/modules/identity/checklist'
import { routes } from '@/shared/routes'

import { getChecklist } from '../../_lib/checklist'

import { HideChecklistButton } from './hide-checklist-button'

/**
 * Список «Освойся в клубе».
 *
 * ─────────────────────────────────────────────────────────────────
 * ВТОРАЯ ПОЛОВИНА ЗНАКОМСТВА
 *
 * Знакомство (шаг 4.6.1) спрашивает четыре вещи и ведёт к одному разбору.
 * Коротко оно ровно потому, что остальное — фотография, первый эфир,
 * вход в чат — отложено сюда. Без этого блока решение убрать фотографию
 * с первого экрана знакомства не имеет оправдания.
 *
 * Ключевое отличие от чек-листа задач: галочку нельзя поставить руками.
 * Каждый пункт вычисляется из того, что человек действительно сделал —
 * из прогресса, из загруженной фотографии, из нажатия на карточку чата.
 * Список, в котором можно отметиться не сделав, — самообман, и платформе
 * он не сообщает ничего.
 * ─────────────────────────────────────────────────────────────────
 *
 * Показывается не всем: исчезает сам при выполнении всего и по кнопке,
 * если человек решил, что ему это не нужно. Постоянный перечень
 * невыполненного на главной — это упрёк, а взрослому хоббисту упрекать
 * себя гитарой незачем.
 */
export async function ClubChecklistBlock({ userId }: { userId: string }) {
  const checklist = await getChecklist(userId)

  if (!checklist || !checklist.visible) return null

  return (
    <section className="border-border bg-surface-raised rounded-xl border p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Освойся в клубе</h2>
          <p className="text-content-muted mt-1 text-sm">
            {checklist.done} из {CHECKLIST_TOTAL} — список исчезнет сам
          </p>
        </div>

        <HideChecklistButton />
      </div>

      <ul className="mt-5 space-y-1">
        {checklist.items.map((item) => (
          <ChecklistRow key={item.key} item={item} />
        ))}
      </ul>
    </section>
  )
}

/**
 * Строка списка.
 *
 * Выполненный пункт остаётся видимым и не зачёркивается: зачёркнутый текст
 * читается хуже, а показать «вот сколько уже сделано» — половина смысла
 * списка. Ссылка у выполненного пункта тоже остаётся: посмотреть второй
 * эфир никто не запрещает.
 */
function ChecklistRow({ item }: { item: ChecklistItem }) {
  const href = ITEM_LINKS[item.key]

  return (
    <li>
      <a
        href={href}
        className="hover:bg-surface-sunken -mx-2 flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 transition-colors"
      >
        <span
          aria-hidden
          className={
            item.done
              ? 'bg-accent text-accent-content flex size-5 shrink-0 items-center justify-center rounded-full'
              : 'border-border-strong size-5 shrink-0 rounded-full border'
          }
        >
          {item.done ? <Check size={13} strokeWidth={3} /> : null}
        </span>

        <span className="min-w-0">
          <span className={item.done ? 'text-content-muted text-sm' : 'text-sm font-medium'}>
            {item.title}
          </span>
          {item.done ? null : (
            <span className="text-content-subtle block text-xs">{item.hint}</span>
          )}
        </span>

        {/* Для чтения с экрана: кружок — украшение, состояние нужно словом */}
        <span className="sr-only">{item.done ? 'выполнено' : 'не выполнено'}</span>
      </a>
    </li>
  )
}

/**
 * Куда ведёт каждый пункт.
 *
 * Чат — исключение: у него нет постоянного адреса, ссылки задаются
 * в настройках платформы и живут в блоке общения ниже на этой же странице.
 * Поэтому пункт ведёт на страницу переходов в Telegram, где карточки
 * те же самые.
 */
const ITEM_LINKS: Record<ChecklistItemKey, string> = {
  song: routes.app.learn.songs(),
  chat: routes.app.club.telegram(),
  stream: routes.app.streams.index(),
  course: routes.app.learn.course(),
  avatar: routes.app.me.profile(),
}
