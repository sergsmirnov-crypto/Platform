import { cn } from '@/ui/lib/cn'

import type { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from 'react'

/**
 * Поля ввода.
 *
 * Высота 48 пикселей, а не привычные 36: платформой пользуются с телефона,
 * часто одной рукой. Мелкие поля на таком экране промахиваются.
 */

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'bg-surface border-border h-12 w-full rounded-md border px-4 text-base',
        'placeholder:text-content-subtle',
        'focus:border-border-strong focus:outline-none',
        'disabled:opacity-50',
        'aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'bg-surface border-border min-h-28 w-full rounded-md border px-4 py-3 text-base',
        'placeholder:text-content-subtle',
        'focus:border-border-strong focus:outline-none',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn('text-content mb-1.5 block text-sm font-medium', className)} {...props} />
  )
}

type FieldProps = {
  label: string
  htmlFor: string
  /** Подсказка под полем: что именно тут ожидается */
  hint?: string | undefined
  /**
   * Текст ошибки. Формулируется как «что не так и что сделать»,
   * без извинений и без общих фраз вида «произошла ошибка».
   */
  error?: string | undefined
  children: React.ReactNode
}

export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div className="mb-4">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-danger mt-1.5 text-sm">{error}</p>
      ) : hint ? (
        <p className="text-content-muted mt-1.5 text-sm">{hint}</p>
      ) : null}
    </div>
  )
}
