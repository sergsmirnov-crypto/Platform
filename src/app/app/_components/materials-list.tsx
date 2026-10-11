import { Download, ExternalLink, FileText, Lock, Music } from 'lucide-react'

import { kindLabel, mediaStrings } from '@/modules/media'
import type { MaterialView, MediaKind } from '@/modules/media'
import { routes } from '@/shared/routes'

/**
 * Материалы: табы, Guitar Pro, минусовки, конспекты.
 *
 * Лежит в общих компонентах закрытой зоны, а не рядом со страницей
 * песни: тот же список показывают запись эфира и, позже, урок курса.
 * Привязка материалов на платформе одна на всех (полиморфные
 * `attachments`), поэтому и компонент один.
 *
 * ─────────────────────────────────────────────────────────────────
 * ССЫЛКА, А НЕ КНОПКА
 *
 * Скачивание — переход, и обычная ссылка даёт всё сразу: работает
 * без JavaScript, открывается в новой вкладке, копируется, правильно
 * объявляется экранным диктором. Постоянного адреса у файла при этом
 * нет: ссылка ведёт на наш обработчик, который проверяет подписку
 * и перенаправляет на подписанный адрес хранилища со сроком жизни
 * в четверть часа.
 * ─────────────────────────────────────────────────────────────────
 *
 * Недоступный материал не прячется. Участник без подписки должен
 * видеть, что табы к этому разбору существуют, — это и есть повод
 * продлить. Скрытый блок не сообщает ничего.
 */

type MaterialsListProps = {
  materials: MaterialView[]
  hasAccess: boolean
}

const ICONS: Partial<Record<MediaKind, typeof FileText>> = {
  pdf: FileText,
  guitar_pro: FileText,
  audio: Music,
  interactive_tab: ExternalLink,
}

export function MaterialsList({ materials, hasAccess }: MaterialsListProps) {
  if (materials.length === 0) {
    return (
      <p className="text-content-muted text-sm">
        {mediaStrings.materials.empty}. {mediaStrings.materials.emptyHint}
      </p>
    )
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {materials.map((material) => (
        <li key={material.id}>
          <MaterialRow material={material} hasAccess={hasAccess} />
        </li>
      ))}
    </ul>
  )
}

function MaterialRow({ material, hasAccess }: { material: MaterialView; hasAccess: boolean }) {
  const Icon = ICONS[material.kind] ?? FileText

  const inner = (
    <>
      <Icon size={18} className="text-content-subtle shrink-0" aria-hidden />

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{material.title}</span>
        <span className="text-content-muted block text-xs">
          {[kindLabel(material.kind), material.sizeLabel].filter(Boolean).join(' · ')}
        </span>
      </span>
    </>
  )

  const frame =
    'flex items-center gap-3 rounded-lg border border-border px-4 py-3 min-h-14 w-full text-left'

  // Обработка после загрузки занимает время. Ссылка на файл, которого
  // ещё нет, привела бы к ошибке хранилища вместо понятного объяснения
  if (!material.isReady) {
    return (
      <span className={`${frame} opacity-60`}>
        {inner}
        <span className="text-content-subtle shrink-0 text-xs">
          {mediaStrings.materials.processing}
        </span>
      </span>
    )
  }

  if (material.externalUrl) {
    return (
      <a
        href={material.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${frame} hover:bg-surface-hover transition-colors`}
      >
        {inner}
        <ExternalLink size={16} className="text-content-subtle shrink-0" aria-hidden />
        <span className="sr-only">{mediaStrings.materials.open}</span>
      </a>
    )
  }

  if (!material.isDownloadable) {
    return (
      <span className={`${frame} opacity-60`}>
        {inner}
        <span className="text-content-subtle shrink-0 text-xs">
          {mediaStrings.materials.notDownloadable}
        </span>
      </span>
    )
  }

  if (!hasAccess) {
    return (
      <span className={`${frame} opacity-60`}>
        {inner}
        <Lock size={16} className="text-content-subtle shrink-0" aria-hidden />
        <span className="sr-only">{mediaStrings.materials.locked}</span>
      </span>
    )
  }

  return (
    <a
      href={routes.api.mediaDownload(material.mediaAssetId)}
      className={`${frame} hover:bg-surface-hover transition-colors`}
    >
      {inner}
      <Download size={16} className="text-content-subtle shrink-0" aria-hidden />
      <span className="sr-only">{mediaStrings.materials.download}</span>
    </a>
  )
}
