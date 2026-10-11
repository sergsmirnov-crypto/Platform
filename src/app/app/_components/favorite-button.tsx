'use client'

import { Bookmark, BookmarkCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { libraryStrings } from '@/modules/library'
import type { FavoriteEntity } from '@/modules/library'
import { Button } from '@/ui'

import { toggleFavoriteAction } from '../_actions/favorites'

/**
 * Кнопка «Отложить».
 *
 * ─────────────────────────────────────────────────────────────────
 * ЕДИНСТВЕННЫЙ КОД В БРАУЗЕРЕ НА СТРАНИЦЕ РАЗБОРА
 *
 * Страница разбора собирается целиком на сервере, и это её сильная
 * сторона: она открывается за один запрос на плохой связи с телефона,
 * стоящего на пюпитре. Эта кнопка стоимость такого свойства
 * не отменяет — она добавляет около килобайта.
 *
 * Плата осознанная. Обычная форма с перезагрузкой страницы на телефоне
 * ощущается как поломка: нажал — экран моргнул, плеер остановился,
 * место просмотра потерялось. Ради одной галочки это слишком дорого.
 * ─────────────────────────────────────────────────────────────────
 *
 * Состояние показывается сразу, до ответа сервера: отложить — действие
 * без последствий, и ждать ради галочки человеку незачем. Не получилось —
 * возвращаем как было и говорим об этом. Молча оставить «отложено» там,
 * где на сервере ничего не сохранилось, нельзя: человек уйдёт
 * с уверенностью, что вернётся к этому позже.
 */

type FavoriteButtonProps = {
  entityType: FavoriteEntity
  entityId: string
  /** Отложено ли сейчас — приходит с сервера при отрисовке страницы */
  initial: boolean
  /**
   * Обновить страницу после переключения.
   *
   * Нужно только на самой странице отложенного, где убранная карточка
   * обязана исчезнуть. На странице разбора обновление лишнее: там
   * меняется одна кнопка, а перерисовка остановила бы плеер.
   */
  refresh?: boolean
  /** Компактный вид: только значок, без подписи — для строк списка */
  compact?: boolean
}

export function FavoriteButton({
  entityType,
  entityId,
  initial,
  refresh = false,
  compact = false,
}: FavoriteButtonProps) {
  const router = useRouter()
  const [isFavorite, setIsFavorite] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const Icon = isFavorite ? BookmarkCheck : Bookmark
  const label = isFavorite ? libraryStrings.button.added : libraryStrings.button.add
  const hint = isFavorite ? libraryStrings.button.addedHint : libraryStrings.button.addHint

  function toggle(): void {
    const next = !isFavorite

    setIsFavorite(next)
    setError(null)

    startTransition(async () => {
      const result = await toggleFavoriteAction({ entityType, entityId, favorite: next })

      if (!result.ok) {
        setIsFavorite(!next)
        // Сообщение сервера, если оно есть: «достигнут предел» человеку
        // полезнее, чем общее «не получилось»
        setError(result.message || libraryStrings.button.failed)
        return
      }

      if (refresh) router.refresh()
    })
  }

  return (
    <div>
      <Button
        onClick={toggle}
        disabled={pending}
        variant={compact ? 'ghost' : 'secondary'}
        size="sm"
        aria-pressed={isFavorite}
        title={hint}
        className={compact ? 'px-3' : undefined}
      >
        <Icon size={18} aria-hidden />
        {compact ? <span className="sr-only">{label}</span> : label}
      </Button>

      {error ? (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
