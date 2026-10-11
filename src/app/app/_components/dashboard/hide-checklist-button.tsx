'use client'

import { X } from 'lucide-react'
import { useTransition } from 'react'

import { hideChecklistAction } from '../../_actions/checklist'

/**
 * Скрыть список «Освойся в клубе».
 *
 * Крестик, а не кнопка со словом: подпись «Скрыть» рядом с заголовком
 * соперничала бы с самим списком за внимание, а нужен он одному человеку
 * из нескольких.
 *
 * Скрытие окончательное — вернуть список нельзя. Кнопка «показать снова»
 * понадобилась бы одному из ста, а пункт в настройках ради неё увидели бы
 * все.
 */
export function HideChecklistButton() {
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      aria-label="Скрыть список"
      onClick={() => {
        startTransition(async () => {
          await hideChecklistAction({})
        })
      }}
      className="text-content-subtle hover:text-content -m-2 flex size-11 shrink-0 items-center justify-center transition-colors disabled:opacity-50"
    >
      <X size={18} aria-hidden />
    </button>
  )
}
