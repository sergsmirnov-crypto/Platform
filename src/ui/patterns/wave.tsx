import { cn } from '@/ui/lib/cn'

/**
 * Фирменная волна — плавная кривая на границе цветовых блоков.
 *
 * Взята с сайта-витрины, но применяется дозированно: экран входа,
 * шапка главной, экран «подписка закончилась». На каждой странице
 * она превратилась бы в шум.
 *
 * Реализована векторно, а не картинкой: тянется на любой экран
 * и весит меньше килобайта.
 */
export function Wave({ className }: { className?: string }) {
  return (
    <svg
      className={cn('block h-12 w-full', className)}
      viewBox="0 0 1200 60"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d="M0,60 C240,0 480,0 720,26 C900,46 1050,52 1200,34 L1200,60 Z" fill="currentColor" />
    </svg>
  )
}
