import type { PublicationStatus } from '@/shared/db/enums'

/**
 * Правила публикации.
 *
 * Отдельно от схем проверки, потому что отвечают на другой вопрос.
 * Схема спрашивает «можно ли это сохранить», здесь — «готово ли это
 * показывать участникам». Разница принципиальная: черновик имеет право
 * быть неполным, опубликованный разбор — нет.
 */

/** Чего не хватает, чтобы разбор можно было опубликовать */
export type PublicationBlocker = {
  field: string
  message: string
}

type PublishableSong = {
  title: string
  artist: string
  arrangements: { status: PublicationStatus; sectionCount: number }[]
}

/**
 * Что мешает публикации.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ СПИСОК ПРЕПЯТСТВИЙ, А НЕ ПРОСТО «НЕЛЬЗЯ»
 *
 * Куратор нажимает «Опубликовать» в конце работы, потратив на разбор
 * полчаса. Ответ «нельзя опубликовать» без объяснения в этот момент —
 * худшее, что может сделать интерфейс: человек не знает, что чинить,
 * и в следующий раз откладывает публикацию вовсе.
 *
 * Поэтому возвращается список: что именно не заполнено и где это
 * находится. Форма подсвечивает поля, а не показывает окно с отказом.
 * ─────────────────────────────────────────────────────────────────
 *
 * Требований намеренно мало. Каждое лишнее — это ещё одна причина
 * не опубликовать разбор сегодня, а риск №2 проекта звучит как
 * «кураторы не публикуют».
 */
export function findPublicationBlockers(song: PublishableSong): PublicationBlocker[] {
  const blockers: PublicationBlocker[] = []

  if (!song.title.trim()) {
    blockers.push({ field: 'title', message: 'Не заполнено название песни' })
  }

  if (!song.artist.trim()) {
    blockers.push({ field: 'artist', message: 'Не заполнен исполнитель' })
  }

  const published = song.arrangements.filter((item) => item.status === 'published')

  if (published.length === 0) {
    blockers.push({
      field: 'arrangements',
      message: 'Нужен хотя бы один опубликованный вариант разбора',
    })
  }

  // Вариант без частей — это пустая страница у участника. Видео при этом
  // не требуем: куратор мог разметить структуру заранее, и такой разбор
  // уже полезен — по нему видно, что песня в работе и из чего состоит
  if (published.length > 0 && published.every((item) => item.sectionCount === 0)) {
    blockers.push({
      field: 'sections',
      message: 'Ни в одном варианте не размечены части разбора',
    })
  }

  return blockers
}

export function canPublish(song: PublishableSong): boolean {
  return findPublicationBlockers(song).length === 0
}

/**
 * Следующее состояние при смене публикации.
 *
 * Снятие с публикации возвращает в черновик, а не в архив: куратор,
 * снявший разбор, чтобы поправить опечатку, не должен искать его
 * в архиве. Архив — отдельное осознанное действие.
 */
export function nextStatus(
  current: PublicationStatus,
  action: 'publish' | 'unpublish' | 'archive' | 'restore',
): PublicationStatus {
  switch (action) {
    case 'publish':
      return 'published'
    case 'unpublish':
      return 'draft'
    case 'archive':
      return 'archived'
    case 'restore':
      return current === 'archived' ? 'draft' : current
  }
}
