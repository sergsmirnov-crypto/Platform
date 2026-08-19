import Image from 'next/image'

import { onboardingStrings } from '@/modules/identity/onboarding-strings'
import { levelLabel } from '@/modules/songs'
import type { SongCard } from '@/modules/songs'
import { routes } from '@/shared/routes'
import { SongCover } from '@/ui/patterns/song-cover'

/**
 * Последний экран знакомства: «твой первый шаг».
 *
 * ─────────────────────────────────────────────────────────────────
 * РАДИ ЭТОГО ЭКРАНА СУЩЕСТВУЕТ ВСЁ ОСТАЛЬНОЕ ЗНАКОМСТВО
 *
 * Четыре вопроса заданы затем, чтобы здесь можно было показать не каталог
 * из двухсот позиций, а одну песню и одну кнопку. Выбор из двухсот
 * для человека, впервые открывшего платформу, равносилен отсутствию
 * выбора: он закроет вкладку и вернётся «когда будет время».
 *
 * Поэтому здесь одна заметная кнопка. Ссылка «осмотрюсь сам» есть,
 * но неброская: она нужна тем, кто пришёл не за этим, и не должна
 * соперничать с главным действием.
 * ─────────────────────────────────────────────────────────────────
 *
 * Серверный компонент: подбор уже сделан на странице, нажимать здесь
 * нечего, кроме ссылок. Клиентского кода этот экран не требует вовсе.
 */
export function FirstStepScreen({
  pick,
}: {
  /** `null` — подбирать нечего: в клубе нет опубликованных разборов */
  pick: { song: SongCard; reason: string } | null
}) {
  if (!pick) return <EmptyFirstStep />

  const { song, reason } = pick

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-10 sm:py-16">
      <h1 className="text-2xl font-bold sm:text-3xl">{onboardingStrings.first.title}</h1>
      <p className="text-content-muted mt-2">{matchLabel(reason)}</p>

      <a
        href={routes.app.learn.song(song.slug)}
        className="border-border hover:border-border-strong mt-8 flex gap-4 rounded-xl border p-4 transition-colors"
      >
        <div className="w-24 shrink-0 sm:w-28">
          {song.coverUrl ? (
            <Image
              src={song.coverUrl}
              alt=""
              width={112}
              height={112}
              className="aspect-square w-full rounded-lg object-cover"
            />
          ) : (
            <SongCover title={song.title} artist={song.artist} seed={song.id} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{song.title}</p>
          <p className="text-content-muted truncate text-sm">{song.artist}</p>

          <div className="text-content-subtle mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {song.levels.map((level) => (
              <span key={level}>{levelLabel(level)}</span>
            ))}
            <span>{song.tuningLabel}</span>
          </div>
        </div>
      </a>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <a
          href={routes.app.learn.song(song.slug)}
          className="bg-accent text-accent-content min-h-11 rounded-full px-6 text-sm leading-11 font-medium"
        >
          {onboardingStrings.first.open}
        </a>

        <a href={routes.app.dashboard()} className="text-content-muted text-sm underline">
          {onboardingStrings.first.later}
        </a>
      </div>
    </div>
  )
}

/**
 * Подпись, объясняющая, откуда взялась эта песня.
 *
 * «Подобрали по твоим жанрам» превращает случайную на вид карточку
 * в ответ на только что заданные вопросы. Без подписи четыре вопроса
 * выглядят потраченным временем.
 */
function matchLabel(reason: string): string {
  if (reason === 'уровень и жанры') return onboardingStrings.first.matchedByGenres
  if (reason === 'уровень' || reason === 'соседний уровень') {
    return onboardingStrings.first.matchedByLevel
  }

  return onboardingStrings.first.matchedAnyway
}

/**
 * Пустая платформа.
 *
 * Кнопка в никуда хуже отсутствия кнопки: человек нажмёт, попадёт в пустой
 * каталог и решит, что платформа сломана. Поэтому вместо подбора —
 * честное объяснение и переход на главную, где есть расписание эфиров
 * и входы в чаты клуба, то есть хоть что-то живое.
 */
function EmptyFirstStep() {
  return (
    <div className="mx-auto w-full max-w-xl px-5 py-10 sm:py-16">
      <h1 className="text-2xl font-bold sm:text-3xl">{onboardingStrings.first.emptyTitle}</h1>
      <p className="text-content-muted mt-3">{onboardingStrings.first.emptyDescription}</p>

      <a
        href={routes.app.dashboard()}
        className="bg-accent text-accent-content mt-8 inline-block min-h-11 rounded-full px-6 text-sm leading-11 font-medium"
      >
        {onboardingStrings.first.toDashboard}
      </a>
    </div>
  )
}
