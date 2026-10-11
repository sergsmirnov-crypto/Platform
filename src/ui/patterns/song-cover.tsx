import { cn } from '@/ui/lib/cn'

/**
 * Обложка разбора.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ НЕ КАРТИНКА
 *
 * Обложек альбомов у нас нет и взяться им неоткуда: скачивать их
 * из открытых источников — это чужие права на изображения в закрытом
 * платном сервисе, а просить кураторов подобрать 280 картинок вручную —
 * это работа, которой они заниматься не станут.
 *
 * Типографская обложка не стоит ничего, не зависит от чужих сервисов,
 * никогда не «не загружается» и выглядит фирменно: крупное название
 * на цветном поле — тот же приём, что на сайте-витрине клуба.
 *
 * Побочная выгода оказалась не меньше главной: каталог из ста карточек
 * весит столько же, сколько пустая страница, и мгновенно открывается
 * с телефона в метро.
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * Палитра.
 *
 * Цвета подобраны так, чтобы чёрный текст читался на любом из них:
 * жёлтый платформы задаёт светлую тональность, и белый текст рядом
 * с ним выглядит инородно. Это то же правило контраста, что у кнопок.
 */
export const COVER_PALETTE = [
  { background: '#ffdd2d', ink: '#16161a' }, // фирменный жёлтый
  { background: '#ffe9a3', ink: '#16161a' },
  { background: '#c9e5d4', ink: '#16161a' },
  { background: '#cfe0f5', ink: '#16161a' },
  { background: '#f3d5c8', ink: '#16161a' },
  { background: '#e2d6f0', ink: '#16161a' },
  { background: '#dfe3c9', ink: '#16161a' },
  { background: '#f5d3d8', ink: '#16161a' },
] as const

export type CoverColors = (typeof COVER_PALETTE)[number]

/**
 * Цвет по строке-семени.
 *
 * Важно, что он **устойчивый**: одна и та же песня всегда одного цвета.
 * Случайный цвет при каждой отрисовке превратил бы каталог в мигающую
 * мозаику, и человек перестал бы узнавать карточки, которые уже видел.
 *
 * Простая сумма кодов символов вместо настоящей хеш-функции — здесь
 * этого достаточно: задача не в равномерности распределения, а в том,
 * чтобы цвет не менялся.
 */
export function coverColors(seed: string): CoverColors {
  let sum = 0
  for (let index = 0; index < seed.length; index += 1) {
    sum = (sum + seed.charCodeAt(index) * (index + 1)) % 9973
  }

  return COVER_PALETTE[sum % COVER_PALETTE.length] as CoverColors
}

/**
 * Насколько крупно писать название.
 *
 * Длинные названия приходится уменьшать, иначе они либо переносятся
 * на пять строк, либо обрезаются на середине слова. Ступени подобраны
 * по числу символов, а не по числу слов: «Всё идёт по плану»
 * и «Stairway to Heaven» занимают примерно одинаково.
 */
export function titleSizeClass(title: string): string {
  if (title.length <= 14) return 'text-2xl sm:text-3xl'
  if (title.length <= 26) return 'text-xl sm:text-2xl'
  if (title.length <= 40) return 'text-lg sm:text-xl'

  return 'text-base sm:text-lg'
}

type SongCoverProps = {
  title: string
  artist: string
  /** Что определяет цвет. Обычно адрес песни — он не меняется */
  seed: string
  className?: string
}

export function SongCover({ title, artist, seed, className }: SongCoverProps) {
  const colors = coverColors(seed)

  return (
    <div
      className={cn(
        'relative flex aspect-square w-full flex-col justify-between overflow-hidden rounded-lg p-4',
        className,
      )}
      style={{ backgroundColor: colors.background, color: colors.ink }}
      // Название и исполнитель уже написаны рядом, в карточке.
      // Для чтения с экрана обложка — украшение, а не содержание
      aria-hidden
    >
      <span className="font-display text-xs font-semibold tracking-wide uppercase opacity-70">
        {artist}
      </span>

      <span
        className={cn(
          'font-display leading-[1.05] font-bold tracking-tight',
          titleSizeClass(title),
        )}
      >
        {title}
      </span>
    </div>
  )
}
