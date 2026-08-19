import type { Note, NoteEntity, NoteRef } from './types'

/**
 * Правила заметок — чистые функции без базы и без запроса.
 */

/**
 * Порядок заметок у одной записи: по времени в ролике.
 *
 * ─────────────────────────────────────────────────────────────────
 * НЕ ПО ДАТЕ СОЗДАНИЯ, ХОТЯ ЭТО НАПРАШИВАЕТСЯ
 *
 * Заметки с таймкодами — это разметка дорожки, а не лента записей.
 * Человек ставит их в том порядке, в каком спотыкается, а читает в том,
 * в каком играет. Список, где пометка про финал стоит выше пометки
 * про вступление, приходится каждый раз пересобирать в голове.
 *
 * Заметки без времени идут в конец: они про запись вообще, и место
 * им — после разметки, а не посреди неё.
 * ─────────────────────────────────────────────────────────────────
 */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.timecodeSec === null && b.timecodeSec === null) {
      return a.createdAt.getTime() - b.createdAt.getTime()
    }

    if (a.timecodeSec === null) return 1
    if (b.timecodeSec === null) return -1

    return a.timecodeSec - b.timecodeSec
  })
}

/**
 * Приведение текста заметки к тому виду, в каком его можно хранить.
 *
 * Пробелы по краям снимаются, пустая строка становится `null`: заметка
 * из одних пробелов — это отсутствие заметки, и класть её в базу
 * означает потом фильтровать её при каждом чтении.
 */
export function normalizeNoteBody(raw: string): string | null {
  const trimmed = raw.trim()

  return trimmed.length > 0 ? trimmed : null
}

/** Умещается ли текст в предел */
export function isNoteTooLong(body: string, limit: number): boolean {
  return body.length > limit
}

/**
 * Осмысленный ли таймкод.
 *
 * Отрицательного времени не бывает, а сутки — предел, взятый с запасом:
 * самая длинная запись эфира втрое короче. Значение приходит из браузера,
 * то есть его может подменить кто угодно.
 */
export function isValidTimecode(seconds: number | null): boolean {
  if (seconds === null) return true

  return Number.isFinite(seconds) && seconds >= 0 && seconds <= 24 * 60 * 60
}

/**
 * Раскладка заметок по записям — для страницы «Мои заметки».
 *
 * Порядок групп задаёт первая заметка в каждой: список приходит свежим
 * сверху, и группа встаёт туда, где человек трогал её последний раз.
 * Внутри группы порядок обычный — по времени в ролике.
 */
export function groupNotes(notes: Note[]): { ref: NoteRef; notes: Note[] }[] {
  const groups = new Map<string, { ref: NoteRef; notes: Note[] }>()

  for (const note of notes) {
    const key = noteGroupKey(note)
    const existing = groups.get(key)

    if (existing) {
      existing.notes.push(note)
      continue
    }

    groups.set(key, {
      ref: { entityType: note.entityType, entityId: note.entityId },
      notes: [note],
    })
  }

  return [...groups.values()].map((group) => ({ ref: group.ref, notes: sortNotes(group.notes) }))
}

export function noteGroupKey(ref: NoteRef): string {
  return `${ref.entityType}:${ref.entityId}`
}

/** Сколько заметок у каждого вида записи — для подписей */
export function countNotesByEntity(notes: NoteRef[]): Record<NoteEntity, number> {
  const counts: Record<NoteEntity, number> = { arrangement: 0, lesson: 0, stream: 0 }

  for (const note of notes) counts[note.entityType] += 1

  return counts
}
