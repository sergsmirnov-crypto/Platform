import { cn } from '@/ui/lib/cn'

/**
 * Список свойств: «Строй — E standard», «Темп — 72 уд/мин».
 *
 * Размечен тегом `<dl>`, а не строками текста. Это не педантизм:
 * пара «название — значение» так и объявляется экранным диктором,
 * а на странице разбора таких пар до пяти подряд, и без разметки
 * они читаются сплошным потоком слов.
 *
 * Пустые значения отсеиваются здесь, а не в каждом месте вызова.
 * У песни редко заполнено всё: каподастра чаще нет, тональность
 * куратор указывает не всегда. Строка «Каподастр — не указан»
 * не сообщает ничего и занимает место, которое на телефоне дорого.
 */

export type Property = {
  label: string
  value: string | null | undefined
}

type PropertyListProps = {
  items: readonly Property[]
  /**
   * `inline` — в строку через разделители, для шапки.
   * `stacked` — столбцом, для боковой панели.
   */
  layout?: 'inline' | 'stacked'
  className?: string
}

export function PropertyList({ items, layout = 'inline', className }: PropertyListProps) {
  const filled = items.filter((item) => item.value)

  if (filled.length === 0) return null

  if (layout === 'stacked') {
    return (
      <dl className={cn('grid gap-2 text-sm', className)}>
        {filled.map((item) => (
          <div key={item.label} className="flex items-baseline justify-between gap-4">
            <dt className="text-content-muted">{item.label}</dt>
            <dd className="text-content text-right font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <dl className={cn('text-content-muted flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      {filled.map((item, index) => (
        <div key={item.label} className="flex items-center gap-1.5">
          {index > 0 ? (
            <span aria-hidden className="text-content-subtle">
              ·
            </span>
          ) : null}
          <dt className="sr-only">{item.label}</dt>
          <dd className="text-content-muted text-sm">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
