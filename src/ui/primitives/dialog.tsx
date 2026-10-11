'use client'

import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { cn } from '@/ui/lib/cn'

import type { ReactNode } from 'react'

/**
 * Модальное окно.
 *
 * Построено на элементе `<dialog>` браузера, а не на своей разметке
 * с наложением. Это не экономия: браузер сам делает то, что в самодельном
 * окне почти всегда сделано наполовину, — запирает фокус клавиатуры
 * внутри окна, отключает содержимое под ним для чтения с экрана,
 * закрывает по Esc и держит окно поверх всего без борьбы со слоями.
 *
 * Расплата одна: окно нельзя анимировать так же свободно, как обычный
 * блок. Для платформы это несущественно.
 */

type DialogProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  /** Кнопки внизу окна */
  footer?: ReactNode
  className?: string
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    if (open && !element.open) {
      element.showModal()
    } else if (!open && element.open) {
      element.close()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        // Иначе браузер закроет окно сам, и наше состояние разойдётся
        // с тем, что видит человек
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // Щелчок мимо содержимого закрывает окно. Сравнение с самим
        // элементом — единственный способ отличить фон от содержимого:
        // затемнение рисует браузер, и отдельного узла у него нет
        if (event.target === ref.current) onClose()
      }}
      className={cn(
        'bg-surface-raised text-content m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl p-0',
        'shadow-card backdrop:bg-black/50',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 p-5 pb-0">
        <div>
          <h2 id="dialog-title" className="text-lg font-bold">
            {title}
          </h2>
          {description ? <p className="text-content-muted mt-1 text-sm">{description}</p> : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="text-content-subtle hover:bg-surface-hover hover:text-content -mt-1 -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      <div className="p-5">{children}</div>

      {footer ? (
        <div className="border-border flex flex-wrap justify-end gap-3 border-t p-5">{footer}</div>
      ) : null}
    </dialog>
  )
}
