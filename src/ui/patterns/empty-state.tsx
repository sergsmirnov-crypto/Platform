import { cn } from '@/ui/lib/cn'

/**
 * Пустое состояние.
 *
 * Правило платформы: пустой экран — это приглашение к действию,
 * а не сообщение «здесь пока ничего нет». Поэтому у него всегда есть
 * объяснение и, как правило, кнопка (PRD v0.1 §12).
 */
type EmptyStateProps = {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      <h3 className="font-display text-xl font-bold">{title}</h3>
      {description ? (
        <p className="text-content-muted mt-2 max-w-sm text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
