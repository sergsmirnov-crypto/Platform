import type { ReactNode, SVGProps } from 'react'

/**
 * Фирменные эмодзи реакций — набор «Реакции» из Figma
 * («Гитарный клуб дизайны», страница «Эмодзи»).
 *
 * ─────────────────────────────────────────────────────────────────
 * ВСТРОЕННЫЕ SVG, А НЕ КАРТИНКИ ИЗ ПАПКИ
 *
 * Десять маленьких значков стоят меньше, чем десять запросов к серверу
 * за файлами, и не мигают при первой отрисовке. Чёткие на любом экране,
 * на тёмной и светлой теме выглядят одинаково: тёмный круглый бейдж
 * задуман дизайнером ровно для этого.
 * ─────────────────────────────────────────────────────────────────
 *
 * Пути перенесены из Figma без изменений, кадр 100×100. Новый значок —
 * новая запись в `PATHS`; подписи и порядок показа живут в модуле
 * реакций, дизайн-система о них не знает.
 */

export type ReactionIconName =
  | 'heart'
  | 'like'
  | 'dislike'
  | 'fire'
  | 'hundred'
  | 'party'
  | 'eyes'
  | 'crown'
  | 'plus_one'
  | 'rocket'

const BADGE =
  'M50 96C75.4051 96 96 75.4051 96 50C96 24.5949 75.4051 4 50 4C24.5949 4 4 24.5949 4 50C4 75.4051 24.5949 96 50 96Z'

const DARK = '#121212'
const RED = '#EF2D25'
const YELLOW = '#FFD400'
const WHITE = '#FFFFFF'

const stroke = {
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

const PATHS: Record<ReactionIconName, ReactNode> = {
  heart: (
    <path
      d="M50 76C30 62 22 52 22 40C22 30 30 24 38 24C44 24 48 28 50 32C52 28 56 24 62 24C70 24 78 30 78 40C78 52 70 62 50 76Z"
      fill={RED}
    />
  ),
  like: (
    <>
      <path
        d="M31 46H25C23.3431 46 22 47.3431 22 49V73C22 74.6569 23.3431 76 25 76H31C32.6569 76 34 74.6569 34 73V49C34 47.3431 32.6569 46 31 46Z"
        fill={YELLOW}
      />
      <path
        d="M38 46L50 24C54.6667 20.6666 57.6667 22 59 28L55 42H71C75.6667 42 77.6667 44.3333 77 49L73 70C72.3333 74 70 76 66 76H38V46Z"
        fill={YELLOW}
      />
    </>
  ),
  dislike: (
    <>
      <path
        d="M69 54H75C76.6569 54 78 52.6569 78 51V27C78 25.3431 76.6569 24 75 24H69C67.3431 24 66 25.3431 66 27V51C66 52.6569 67.3431 54 69 54Z"
        fill={WHITE}
      />
      <path
        d="M62 54L50 76C45.3333 79.3334 42.3333 78 41 72L45 58H29C24.3333 58 22.3333 55.6667 23 51L27 30C27.6667 26 30 24 34 24H62L62 54Z"
        fill={WHITE}
      />
    </>
  ),
  fire: (
    <>
      <path
        d="M50 16C60.6667 26.6667 66 36.6667 66 46C70 42 72 37.6667 72 33C80 43 83.3334 52.6667 82 62C80.6667 75.3333 70 82.6667 50 84C30 82.6667 19.3334 75.3333 18 62C17.3334 51.3333 21.3334 42 30 34C31.3334 40.6667 34 45.3333 38 48C36.6667 36 40.6667 25.3333 50 16Z"
        fill={RED}
      />
      <path
        d="M50 50C56.6667 56.6667 60 62.6667 60 68C60 74.6667 56.6667 78 50 78C43.3333 78 40 74.6667 40 68C40 62.6667 43.3333 56.6667 50 50Z"
        fill={YELLOW}
      />
    </>
  ),
  hundred: (
    <>
      <path d="M21 38L28 33V67" stroke={YELLOW} strokeWidth={7} {...stroke} />
      <path
        d="M47 66C51.9706 66 56 58.8366 56 50C56 41.1634 51.9706 34 47 34C42.0294 34 38 41.1634 38 50C38 58.8366 42.0294 66 47 66Z"
        stroke={YELLOW}
        strokeWidth={7}
        {...stroke}
      />
      <path
        d="M72 66C76.9706 66 81 58.8366 81 50C81 41.1634 76.9706 34 72 34C67.0294 34 63 41.1634 63 50C63 58.8366 67.0294 66 72 66Z"
        stroke={YELLOW}
        strokeWidth={7}
        {...stroke}
      />
      <path d="M22 78H78" stroke={RED} strokeWidth={5} {...stroke} />
    </>
  ),
  party: (
    <>
      <path d="M24 78L38 36L64 62L24 78Z" fill={YELLOW} />
      <path d="M31 57L45 70" stroke={RED} strokeWidth={4} {...stroke} />
      <circle cx={64} cy={28} r={4} fill={RED} />
      <circle cx={76} cy={44} r={4} fill={YELLOW} />
      <circle cx={50} cy={22} r={3} fill={WHITE} />
      <path
        d="M74 18C74 23.3333 76.6667 26 82 26C76.6667 26 74 28.6667 74 34C74 28.6667 71.3333 26 66 26C71.3333 26 74 23.3333 74 18Z"
        fill={WHITE}
      />
      <path
        d="M52 40C57.3333 36 58.6667 31.3333 56 26"
        stroke={WHITE}
        strokeWidth={4}
        {...stroke}
      />
    </>
  ),
  eyes: (
    <>
      <ellipse cx={37} cy={50} rx={12} ry={17} fill={WHITE} />
      <ellipse cx={63} cy={50} rx={12} ry={17} fill={WHITE} />
      <circle cx={41} cy={54} r={6} fill={DARK} />
      <circle cx={67} cy={54} r={6} fill={DARK} />
    </>
  ),
  crown: (
    <>
      <path
        d="M22 66L26 34L40 49L50 28L60 49L74 34L78 66H22Z"
        fill={YELLOW}
        stroke={YELLOW}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <rect x={22} y={69} width={56} height={8} rx={2} fill={YELLOW} />
      <circle cx={50} cy={56} r={5} fill={RED} />
    </>
  ),
  plus_one: (
    <>
      <path d="M20 50H44M32 38V62" stroke={YELLOW} strokeWidth={8} {...stroke} />
      <path d="M58 38L67 32V70" stroke={YELLOW} strokeWidth={8} {...stroke} />
    </>
  ),
  rocket: (
    <>
      <path d="M34 56L24 70L38 68L34 56Z" fill={RED} />
      <path d="M66 56L76 70L62 68L66 56Z" fill={RED} />
      <path d="M42 72C47.3333 84 52.6667 84 58 72H42Z" fill={YELLOW} />
      <path
        d="M50 14C60.6667 23.3333 66 37.3333 66 56L60 70H40L34 56C34 37.3333 39.3333 23.3333 50 14Z"
        fill={WHITE}
      />
      <circle cx={50} cy={42} r={7} fill={YELLOW} stroke={DARK} strokeWidth={3} />
    </>
  ),
}

type ReactionIconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: ReactionIconName
  /** Сторона значка в пикселях */
  size?: number
}

/**
 * Значок реакции. Декоративный: подпись даёт кнопка, в которой он стоит,
 * поэтому значок скрыт от экранного диктора.
 */
export function ReactionIcon({ name, size = 20, ...props }: ReactionIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
      {...props}
    >
      <path d={BADGE} fill={DARK} />
      {PATHS[name]}
    </svg>
  )
}
