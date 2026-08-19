'use client'

import { ExternalLink, FileText } from 'lucide-react'
import { useState } from 'react'

import type { MaterialView } from '@/modules/media'
import { routes } from '@/shared/routes'

/**
 * Табы рядом с видео.
 *
 * ─────────────────────────────────────────────────────────────────
 * НА БОЛЬШОМ ЭКРАНЕ — РЯДОМ, НА ТЕЛЕФОНЕ — ОТДЕЛЬНОЙ ВКЛАДКОЙ
 *
 * Одновременно видеть видео и табы можно только там, где для этого
 * есть место. На телефоне в вертикальном положении их приходится
 * ужимать до нечитаемости: табы — это мелкие цифры на шести линейках,
 * и половина экрана для них хуже, чем ничего.
 *
 * Поэтому на узком экране здесь кнопка, открывающая табы отдельной
 * вкладкой. Встроенный просмотрщик даёт то, чего наша рамка не даст
 * никогда: разведение пальцами, поворот и полный экран.
 *
 * Это не заглушка «пока не сделали» — это правильное поведение
 * для телефона, стоящего на пюпитре.
 * ─────────────────────────────────────────────────────────────────
 *
 * Показываются только PDF и картинки — остальное показывать нечем
 * (правило `canViewInline` в модуле медиа). Guitar Pro и минусовки
 * остаются на обычной странице разбора.
 */

export function TabsPane({ materials }: { materials: MaterialView[] }) {
  const [currentId, setCurrentId] = useState(materials[0]?.mediaAssetId ?? null)

  if (materials.length === 0) return null

  const current = materials.find((item) => item.mediaAssetId === currentId) ?? materials[0]
  if (!current) return null

  const viewUrl = routes.api.mediaView(current.mediaAssetId)

  return (
    <section className="border-border flex min-h-0 flex-col rounded-xl border">
      <header className="border-border flex items-center justify-between gap-3 border-b p-3">
        <span className="text-content-subtle text-xs tracking-wide uppercase">Табы</span>

        <a
          href={viewUrl}
          target="_blank"
          rel="noreferrer"
          className="text-content-muted hover:text-content inline-flex h-9 items-center gap-1.5 text-sm"
        >
          <ExternalLink size={16} aria-hidden />
          Открыть отдельно
        </a>
      </header>

      {materials.length > 1 ? (
        <div className="border-border flex flex-wrap gap-2 border-b p-3">
          {materials.map((material) => (
            <button
              key={material.mediaAssetId}
              type="button"
              onClick={() => setCurrentId(material.mediaAssetId)}
              aria-pressed={material.mediaAssetId === current.mediaAssetId}
              className={
                material.mediaAssetId === current.mediaAssetId
                  ? 'border-accent bg-accent text-accent-content inline-flex h-10 items-center rounded-full border px-3 text-sm font-medium'
                  : 'border-border text-content-muted hover:border-border-strong inline-flex h-10 items-center rounded-full border px-3 text-sm'
              }
            >
              {material.title}
            </button>
          ))}
        </div>
      ) : null}

      {/*
        На узком экране рамки нет вовсе: она не отрисовывается, а не
        прячется стилями. Скрытая рамка всё равно загрузила бы файл —
        трафик за то, чего человек не увидит
      */}
      <div className="hidden min-h-0 flex-1 lg:block">
        <iframe
          // Ключ по материалу: при переключении таба рамка должна
          // загрузиться заново, а не остаться на старом файле
          key={current.mediaAssetId}
          src={viewUrl}
          title={`Табы: ${current.title}`}
          className="h-full min-h-[60vh] w-full rounded-b-xl"
        />
      </div>

      <a
        href={viewUrl}
        target="_blank"
        rel="noreferrer"
        className="border-border hover:border-border-strong m-3 flex h-14 items-center justify-center gap-2 rounded-xl border font-medium lg:hidden"
      >
        <FileText size={20} aria-hidden />
        Открыть табы
      </a>
    </section>
  )
}
