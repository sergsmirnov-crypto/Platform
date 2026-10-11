import { cn } from '@/ui/lib/cn'

/**
 * Шапка страницы: надзаголовок, заголовок, действия.
 *
 * Надзаголовок (мелкими прописными) кодирует раздел, а не украшает:
 * человек всегда понимает, где находится.
 */
type PageHeaderProps = {
  title: string
  eyebrow?: string | undefined
  description?: string | undefined
  actions?: React.ReactNode | undefined
  className?: string | undefined
}

export function PageHeader({ title, eyebrow, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-8 flex flex-wrap items-end justify-between gap-4', className)}>
      <div>
        {eyebrow ? (
          <p className="text-content-muted text-xs font-semibold tracking-[0.08em] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display mt-1 text-3xl font-extrabold">{title}</h1>
        {description ? <p className="text-content-muted mt-2 max-w-xl">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  )
}
