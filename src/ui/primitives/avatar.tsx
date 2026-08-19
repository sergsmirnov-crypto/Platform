import { User } from 'lucide-react'

import { cn } from '@/ui/lib/cn'

/**
 * Аватар участника.
 *
 * Пока фотография не загружена — нейтральный силуэт, а не первая буква
 * имени и не пустой круг. Буква выглядит как аватар, которого человек
 * не выбирал; пустой круг читается как поломка интерфейса. Силуэт честно
 * означает «фотографии нет».
 *
 * Фотография из Telegram намеренно не подставляется: по решению
 * владельца платформы участник либо загружает снимок сам, либо остаётся
 * без него. Побочная выгода — ссылка на снимок из Telegram перестала бы
 * открываться при недоступности мессенджера, а платформа обязана
 * работать и в этом случае.
 *
 * Изображение выводится обычным тегом, без средства оптимизации картинок
 * Next.js. Оптимизировать нечего: файл уже приведён к нужному размеру
 * и формату при загрузке, а посредник только добавил бы нагрузку
 * на наш сервер там, где сейчас работает сеть доставки.
 */

type AvatarProps = {
  src?: string | null | undefined
  alt?: string | undefined
  size?: keyof typeof SIZES | undefined
  className?: string | undefined
}

const SIZES = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-24 w-24',
  /** Только страница профиля: там фотография — предмет разговора */
  xl: 'h-32 w-32',
} as const

const ICON_SIZES = { sm: 16, md: 22, lg: 40, xl: 52 } as const

export function Avatar({ src, alt = '', size = 'md', className }: AvatarProps) {
  const base = cn(
    'bg-surface-hover text-content-subtle flex shrink-0 items-center justify-center overflow-hidden rounded-full',
    SIZES[size],
    className,
  )

  if (!src) {
    return (
      <span className={base} role="img" aria-label={alt || 'Фотография не загружена'}>
        <User size={ICON_SIZES[size]} aria-hidden />
      </span>
    )
  }

  return (
    <span className={base}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="h-full w-full object-cover" />
    </span>
  )
}
