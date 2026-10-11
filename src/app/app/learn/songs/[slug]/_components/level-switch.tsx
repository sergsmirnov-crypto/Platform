import { hasVariantChoice, levelLabel, songStrings, variantLabel } from '@/modules/songs'
import type { ArrangementView, LevelGroup } from '@/modules/songs'
import { Badge, PillLink } from '@/ui'

import { songUrl } from '../_lib/song-url'

/**
 * Переключатель уровня и варианта разбора.
 *
 * ─────────────────────────────────────────────────────────────────
 * ГЛАВНЫЙ ЭЛЕМЕНТ УПРАВЛЕНИЯ НА СТРАНИЦЕ
 *
 * Всё остальное на странице — чтение; здесь человек делает выбор,
 * от которого зависит, справится он с песней или бросит её.
 * Поэтому переключатель стоит выше структуры разбора и не сворачивается
 * на телефоне.
 * ─────────────────────────────────────────────────────────────────
 *
 * Второй ряд — варианты одного уровня — появляется только тогда,
 * когда их действительно несколько. Постоянно висящий ряд из одного
 * элемента задаёт каждому участнику вопрос «а что ещё я должен здесь
 * выбрать?», на который нет ответа.
 */

type LevelSwitchProps = {
  slug: string
  groups: LevelGroup<ArrangementView>[]
  siblings: ArrangementView[]
  current: ArrangementView
}

export function LevelSwitch({ slug, groups, siblings, current }: LevelSwitchProps) {
  return (
    <div className="space-y-3">
      <nav aria-label={songStrings.song.levelSwitch} className="flex flex-wrap gap-2">
        {groups.map((group) => (
          <PillLink
            key={group.level}
            href={songUrl(slug, { level: group.level })}
            size="md"
            current={group.level === current.level}
          >
            {levelLabel(group.level)}
            {group.arrangements.length > 1 ? (
              <span className="text-xs opacity-60">{group.arrangements.length}</span>
            ) : null}
          </PillLink>
        ))}
      </nav>

      {hasVariantChoice(siblings) ? (
        <nav aria-label={songStrings.song.variantSwitch} className="flex flex-wrap gap-2">
          {siblings.map((arrangement, index) => (
            <PillLink
              key={arrangement.id}
              href={songUrl(slug, { level: arrangement.level, variantId: arrangement.id })}
              current={arrangement.id === current.id}
            >
              {variantLabel(arrangement, index)}
              {!arrangement.isPublic ? (
                <Badge variant="draft" size="sm">
                  {songStrings.status.draft}
                </Badge>
              ) : null}
            </PillLink>
          ))}
        </nav>
      ) : null}
    </div>
  )
}
