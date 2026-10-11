import { songStrings } from '@/modules/songs'
import type { SectionView } from '@/modules/songs'
import { EmptyState } from '@/ui'

import { SectionRow } from './section-row'

/**
 * Структура разбора: из каких частей он состоит.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЭТО ОГЛАВЛЕНИЕ, А НЕ СПИСОК ВИДЕО
 *
 * Разбор длится час с лишним, и целиком его никто не смотрит. Человек
 * приходит доучить соло, к которому подступался вчера, и ему нужно
 * попасть в него за одно нажатие. Поэтому у каждой части свой якорь
 * в адресе: ссылку на конкретную часть можно прислать в чат,
 * а «продолжить с места» на Этапе 10 будет вести именно сюда.
 * ─────────────────────────────────────────────────────────────────
 *
 * Кнопки воспроизведения здесь пока нет: видеохостинг подключается
 * на шаге 5.4. Часть без видео при этом не исчезает и не помечается
 * ошибкой — куратор мог разметить структуру до загрузки роликов,
 * и это нормальное состояние работы, а не поломка.
 */

type SectionListProps = {
  sections: SectionView[]
}

export function SectionList({ sections }: SectionListProps) {
  if (sections.length === 0) {
    return (
      <EmptyState
        title={songStrings.song.noSections}
        description={songStrings.song.noVideoHint}
        className="border-border rounded-lg border border-dashed py-10"
      />
    )
  }

  return (
    <ol className="border-border divide-border divide-y overflow-hidden rounded-lg border">
      {sections.map((section, index) => (
        <li
          key={section.id}
          id={`section-${section.id}`}
          // Отступ сверху при переходе по якорю: иначе часть уезжает
          // под шапку страницы и человек её не видит
          className="hover:bg-surface-hover scroll-mt-24 transition-colors"
        >
          <SectionRow section={section} index={index} />
        </li>
      ))}
    </ol>
  )
}
