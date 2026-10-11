import { cva } from 'class-variance-authority'

import { cn } from '@/ui/lib/cn'

import type { VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

/**
 * Метка: уровень сложности, строй гитары, состояние публикации.
 *
 * Уровни различаются не только цветом, но и текстом — человек
 * с нарушением цветовосприятия должен понимать их так же легко.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-sunken text-content-muted',
        accent: 'bg-accent text-accent-content',
        outline: 'border border-border text-content-muted',
        /** Черновик виден только куратору — метка не должна быть незаметной */
        draft: 'border border-dashed border-border-strong text-content-muted',
        danger: 'bg-danger text-danger-content',
      },
      size: {
        sm: 'px-2 py-0.5 text-[0.6875rem]',
        md: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: { variant: 'neutral', size: 'md' },
  },
)

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
}
