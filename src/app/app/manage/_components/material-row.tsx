'use client'

import { ArrowDown, ArrowUp, ExternalLink, FileText, Music, Image as ImageIcon } from 'lucide-react'
import { useState, useTransition } from 'react'

import { kindLabel, mediaStrings } from '@/modules/media'
import type { EditorMaterial, MediaKind } from '@/modules/media'
import { Button, Input } from '@/ui'

import {
  moveMaterialAction,
  renameMaterialAction,
  setMaterialDownloadableAction,
} from '../_actions/materials'

/**
 * Один материал в списке куратора.
 *
 * Подпись сохраняется при уходе из поля, а не по кнопке: та же логика,
 * что у частей разбора. Кнопка «Сохранить» рядом с каждым из четырёх
 * полей превращает список в частокол, а забытое нажатие — в потерянную
 * правку.
 */

const strings = mediaStrings.editor

const ICONS: Partial<Record<MediaKind, typeof FileText>> = {
  pdf: FileText,
  guitar_pro: FileText,
  audio: Music,
  image: ImageIcon,
  interactive_tab: ExternalLink,
}

type MaterialRowProps = {
  material: EditorMaterial
  publicPath: string | null
  isFirst: boolean
  isLast: boolean
  onChanged: () => void
  onRemove: (material: EditorMaterial) => void
}

export function MaterialRow({
  material,
  publicPath,
  isFirst,
  isLast,
  onChanged,
  onRemove,
}: MaterialRowProps) {
  const [title, setTitle] = useState(material.title ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const Icon = ICONS[material.kind] ?? FileText

  function run(action: () => Promise<{ ok: boolean; message?: string }>): void {
    setError(null)

    startTransition(async () => {
      const result = await action()

      if (!result.ok) {
        setError(result.message ?? strings.saveFailed)
        return
      }

      onChanged()
    })
  }

  function saveTitle(): void {
    const next = title.trim()
    if (next === (material.title ?? '')) return

    run(() => renameMaterialAction({ attachmentId: material.id, title: next, publicPath }))
  }

  return (
    <li className="border-border bg-surface-raised rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Icon size={18} className="text-content-subtle shrink-0" aria-hidden />

        <div className="min-w-48 flex-1">
          <Input
            value={title}
            placeholder={strings.titlePlaceholder}
            aria-label={strings.titlePlaceholder}
            disabled={pending}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={saveTitle}
          />
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={pending || isFirst}
            aria-label={strings.moveUp}
            onClick={() =>
              run(() =>
                moveMaterialAction({ attachmentId: material.id, direction: 'up', publicPath }),
              )
            }
          >
            <ArrowUp size={16} aria-hidden />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            disabled={pending || isLast}
            aria-label={strings.moveDown}
            onClick={() =>
              run(() =>
                moveMaterialAction({ attachmentId: material.id, direction: 'down', publicPath }),
              )
            }
          >
            <ArrowDown size={16} aria-hidden />
          </Button>

          <Button size="sm" variant="ghost" disabled={pending} onClick={() => onRemove(material)}>
            {strings.remove}
          </Button>
        </div>
      </div>

      <div className="text-content-muted mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-7 text-xs">
        <span>{kindLabel(material.kind)}</span>
        {material.sizeLabel ? <span>{material.sizeLabel}</span> : null}
        {!material.isReady ? <span>{mediaStrings.materials.processing}</span> : null}

        {material.isExternal ? (
          <a
            href={material.externalUrl ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-content underline"
          >
            {mediaStrings.materials.open}
          </a>
        ) : (
          // Переключатель, а не галочка в форме: он применяется сразу,
          // и промежуточного состояния «выбрал, но не сохранил» не бывает
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={material.isDownloadable}
              disabled={pending}
              onChange={(event) =>
                run(() =>
                  setMaterialDownloadableAction({
                    attachmentId: material.id,
                    isDownloadable: event.target.checked,
                    publicPath,
                  }),
                )
              }
            />
            {material.isDownloadable ? strings.downloadable : strings.notDownloadable}
          </label>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-danger mt-2 pl-7 text-sm">
          {error}
        </p>
      ) : null}
    </li>
  )
}
