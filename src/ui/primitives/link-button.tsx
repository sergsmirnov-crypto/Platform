import Link from 'next/link'

import { cn } from '../lib/cn'

import { buttonVariants } from './button'

import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

/**
 * Ссылка, выглядящая как кнопка.
 *
 * Отдельный компонент, а не свойство у кнопки: под ссылкой и кнопкой
 * в разметке лежат разные теги, и это важно. Ссылку можно открыть
 * в новой вкладке, скопировать адрес, а скринридер объявит её как переход,
 * а не как действие.
 *
 * Правило простое: переход на другую страницу — LinkButton,
 * действие на текущей — Button.
 */
export type LinkButtonProps = ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>

export function LinkButton({ className, variant, size, fullWidth, ...props }: LinkButtonProps) {
  return <Link className={cn(buttonVariants({ variant, size, fullWidth }), className)} {...props} />
}
