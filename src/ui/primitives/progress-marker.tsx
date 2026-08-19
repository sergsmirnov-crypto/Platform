import { cn } from '@/ui/lib/cn'

/**
 * ФИРМЕННЫЙ ЭЛЕМЕНТ ПЛАТФОРМЫ.
 *
 * Подсветка маркером взята из логотипа «Ваня, [научи!]». Здесь тот же приём
 * работает индикатором прогресса: жёлтая заливка проходит по названию разбора
 * по мере прохождения частей.
 *
 * Смысл в том, что приём из бренда становится функцией, а не украшением, —
 * этого у сайта-витрины быть не могло.
 *
 * Доступность: значение дублируется текстом и атрибутами для скринридера,
 * поэтому прогресс понятен и без цвета.
 */
type ProgressMarkerProps = {
  children: React.ReactNode
  /** Доля выполненного: от 0 до 1 */
  value: number
  /** Расшифровка для скринридера: «3 из 6 частей» */
  label: string
  className?: string
}

export function ProgressMarker({ children, value, label, className }: ProgressMarkerProps) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100)

  return (
    <span
      className={cn('relative inline-block', className)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span
        aria-hidden
        className="bg-accent-soft absolute bottom-0 left-0 h-[0.55em] transition-[width] duration-500"
        style={{ width: `${percent}%` }}
      />
      <span className="relative">{children}</span>
    </span>
  )
}
