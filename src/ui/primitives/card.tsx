import { cn } from '@/ui/lib/cn'

import type { HTMLAttributes } from 'react'

/**
 * Карточка — основной контейнер платформы.
 *
 * Структура взята из карточек табов на сайте-витрине: обложка сверху,
 * название, строка со свойствами, действия внизу. Отличие в назначении:
 * там кнопка звала купить, здесь — продолжить с того места,
 * где человек остановился.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-surface-raised border-border overflow-hidden rounded-lg border', className)}
      {...props}
    />
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('font-display text-lg leading-tight font-bold', className)} {...props} />
}

export function CardMeta({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-content-muted text-sm', className)} {...props} />
}

export function CardActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-4 flex flex-col gap-2', className)} {...props} />
}
