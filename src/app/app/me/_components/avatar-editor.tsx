'use client'

import { useEffect, useState, useTransition } from 'react'

import { uploadAvatar } from '@/modules/identity/actions'
import { AVATAR_SIZES, AVATAR_SOURCE_SIZE } from '@/modules/identity/avatar'
import { identityStrings } from '@/modules/identity/strings'
import { Button, Dialog, ImageCropper } from '@/ui'
import { centeredSquare } from '@/ui/lib/crop-geometry'
import type { CropRect } from '@/ui/lib/crop-geometry'
import { cropToBlob, loadImageFromFile } from '@/ui/lib/crop-to-blob'

/**
 * Окно подготовки фотографии.
 *
 * Загружается по требованию (`next/dynamic` в карточке рядом): это
 * единственное место в личном кабинете с заметным объёмом кода для
 * браузера, и держать его на странице профиля постоянно незачем.
 *
 * Что здесь происходит по шагам:
 *   1. файл читается в изображение — заодно так решается вопрос
 *      с форматом HEIC, который присылают айфоны;
 *   2. человек подбирает кадр;
 *   3. кадр вырезается на холсте и уменьшается до 1024 точек;
 *   4. результат уходит на сервер, где пересобирается заново.
 *
 * Шаг 4 существует не для красоты: браузеру верить нельзя, до сервера
 * можно достучаться и минуя это окно.
 */

const strings = identityStrings.avatar.editor

type AvatarEditorProps = {
  file: Blob
  onClose: () => void
  onSaved: () => void
}

export default function AvatarEditor({ file, onClose, onSaved }: AvatarEditorProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [rect, setRect] = useState<CropRect | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false

    loadImageFromFile(file)
      .then((loaded) => {
        if (cancelled) return

        setImage(loaded)
        // Пока человек не тронул кадр, берётся центральный квадрат —
        // тот же, что показан в окне. Иначе «Сохранить» сразу после
        // открытия дало бы не то, что видно на экране
        setRect(centeredSquare({ width: loaded.naturalWidth, height: loaded.naturalHeight }))
      })
      .catch(() => {
        if (!cancelled) setError(identityStrings.avatar.errors.browserFailed)
      })

    return () => {
      cancelled = true
    }
  }, [file])

  function handleSave() {
    if (!image || !rect) return

    setError(null)

    startTransition(async () => {
      let prepared: Blob

      try {
        prepared = await cropToBlob(image, rect, { size: AVATAR_SOURCE_SIZE })
      } catch {
        setError(identityStrings.avatar.errors.browserFailed)
        return
      }

      const form = new FormData()
      form.set('file', prepared)

      const result = await uploadAvatar(form)

      if (!result.ok) {
        setError(result.fields?.file ?? result.message)
        return
      }

      onSaved()
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={strings.title}
      description={strings.description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {strings.cancel}
          </Button>
          <Button onClick={handleSave} disabled={pending || !rect}>
            {pending ? strings.saving : strings.save}
          </Button>
        </>
      }
    >
      {image ? (
        <ImageCropper
          src={image.src}
          naturalWidth={image.naturalWidth}
          naturalHeight={image.naturalHeight}
          zoomLabel={strings.zoom}
          onChange={setRect}
          round
        />
      ) : (
        <div
          className="bg-surface-sunken aspect-square w-full animate-pulse rounded-lg"
          aria-hidden
        />
      )}

      {error ? (
        <p role="alert" className="text-danger mt-3 text-sm">
          {error}
        </p>
      ) : null}

      <p className="text-content-subtle mt-3 text-xs">
        Фотография сохранится квадратом {AVATAR_SIZES.lg}×{AVATAR_SIZES.lg} точек
      </p>
    </Dialog>
  )
}
