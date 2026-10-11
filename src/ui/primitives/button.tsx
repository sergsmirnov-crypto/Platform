import { cva } from 'class-variance-authority'

import { cn } from '@/ui/lib/cn'

import type { VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'

/**
 * Кнопка.
 *
 * Иерархия повторяет сайт-витрину: главное действие — жёлтая заливка
 * с чёрным текстом, второстепенное — прозрачная кнопка с обводкой.
 * Ровно как пара «Купить табы / Видео аранжировки» в карточках табов.
 *
 * Правило контраста: на жёлтом всегда чёрный текст. Белый на жёлтом
 * нечитаем и в дизайн-системе не встречается нигде.
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-full font-medium',
    'transition-colors duration-150',
    'disabled:pointer-events-none disabled:opacity-50',
    // Тап-таргет не меньше 44px — требование для работы с телефона,
    // особенно когда в руках гитара (PRD v0.1 §10)
    'min-h-11',
  ],
  {
    variants: {
      variant: {
        /** Главное действие на экране. Такое действие должно быть одно */
        primary: 'bg-accent text-accent-content hover:bg-accent-hover',
        /** Второстепенное действие */
        secondary: 'border border-border-strong bg-transparent text-content hover:bg-surface-hover',
        /** Третьестепенное: ссылки-действия, отмена */
        ghost: 'bg-transparent text-content hover:bg-surface-hover',
        /**
         * Разрушительное действие: удалить, отозвать доступ.
         * Красный на платформе означает ровно одно — «дальше пути назад нет».
         */
        danger: 'bg-danger text-danger-content hover:opacity-90',
      },
      size: {
        sm: 'h-11 px-4 text-sm',
        md: 'h-12 px-6 text-base',
        lg: 'h-14 px-8 text-lg',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  },
)

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, fullWidth, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size, fullWidth }), className)} {...props} />
  )
}

export { buttonVariants }
