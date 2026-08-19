import { cn } from '@/ui/lib/cn'

import type { HTMLAttributes } from 'react'

/**
 * Заполнитель на время загрузки.
 *
 * Показывает форму будущего содержимого, а не крутящийся кружок:
 * человек видит, что именно грузится, и страница не прыгает,
 * когда данные приходят.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-surface-sunken animate-pulse rounded-md', className)}
      aria-hidden
      {...props}
    />
  )
}
