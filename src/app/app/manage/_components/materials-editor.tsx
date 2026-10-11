'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { mediaStrings, UPLOAD_ACCEPT, uploadErrors } from '@/modules/media'
import type { EditorMaterial } from '@/modules/media'
import { routes } from '@/shared/routes'
import { Button, Dialog, Field, FileDrop, Input, uploadFile } from '@/ui'

import { addExternalMaterialAction, deleteMaterialAction } from '../_actions/materials'

import { MaterialRow } from './material-row'

/**
 * Материалы объекта: загрузка, список, ссылка на интерактивные табы.
 *
 * Не знает, к чему привязан: вид объекта и идентификатор приходят
 * снаружи. Обещание сдержалось на шаге 7.3 — эфиры получили тот же
 * компонент, изменился только список допустимых видов. Отсюда и переезд
 * из папки разборов в общую.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЧТО ПРОИСХОДИТ ПРИ ЗАГРУЗКЕ
 *
 *   браузер → POST /api/media/upload (байты + имя файла)
 *           ← идентификаторы записи и привязки
 *           → router.refresh(): страница перечитывается на сервере
 *
 * Список не собирается в браузере вручную. Обновление страницы стоит
 * один запрос, но исключает целый класс ошибок, когда показанное
 * расходится с сохранённым — а именно эти ошибки замечает куратор
 * и не замечает разработчик.
 * ─────────────────────────────────────────────────────────────────
 */

const strings = mediaStrings.editor

type MaterialsEditorProps = {
  entityType: 'song' | 'arrangement' | 'stream'
  entityId: string
  /** Страница участника, которую надо перечитать после правки */
  publicPath: string | null
  materials: EditorMaterial[]
  /** Может ли этот человек добавлять файлы. Правка своих — всегда */
  canUpload: boolean
}

export function MaterialsEditor({
  entityType,
  entityId,
  publicPath,
  materials,
  canUpload,
}: MaterialsEditorProps) {
  const router = useRouter()

  const [progress, setProgress] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<EditorMaterial | null>(null)
  const [showLinkForm, setShowLinkForm] = useState(false)

  async function handleFile(file: File): Promise<void> {
    setError(null)
    setBusy(true)
    setProgress(0)

    const result = await uploadFile({
      url: routes.api.mediaUpload({ entityType, entityId }),
      file,
      onProgress: setProgress,
    })

    setBusy(false)
    setProgress(null)

    if (!result.ok) {
      setError(result.fields?.file ?? result.message ?? uploadErrors.failed)
      return
    }

    router.refresh()
  }

  return (
    <div>
      <ul className="mb-3 space-y-2">
        {materials.map((material, index) => (
          <MaterialRow
            key={material.id}
            material={material}
            publicPath={publicPath}
            isFirst={index === 0}
            isLast={index === materials.length - 1}
            onChanged={() => router.refresh()}
            onRemove={setRemoving}
          />
        ))}
      </ul>

      {materials.length === 0 ? (
        <p className="text-content-muted mb-3 text-sm">{strings.empty}</p>
      ) : null}

      {canUpload ? (
        <>
          <FileDrop
            accept={UPLOAD_ACCEPT}
            label={strings.dropHere}
            hint={strings.accepted}
            busy={busy}
            busyLabel={strings.uploading}
            progress={progress}
            error={error}
            onFile={(file) => void handleFile(file)}
          />

          <div className="mt-3">
            {showLinkForm ? (
              <ExternalLinkForm
                entityType={entityType}
                entityId={entityId}
                publicPath={publicPath}
                onDone={() => {
                  setShowLinkForm(false)
                  router.refresh()
                }}
                onCancel={() => setShowLinkForm(false)}
              />
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setShowLinkForm(true)}>
                {strings.external.add}
              </Button>
            )}
          </div>
        </>
      ) : null}

      <RemoveDialog
        material={removing}
        publicPath={publicPath}
        onClose={() => setRemoving(null)}
        onRemoved={() => {
          setRemoving(null)
          router.refresh()
        }}
      />
    </div>
  )
}

/**
 * Ссылка на интерактивные табы.
 *
 * Отдельная свёрнутая форма, а не поле рядом с загрузкой: ссылку
 * добавляют редко, а место она занимает столько же, сколько зона
 * перетаскивания.
 */
function ExternalLinkForm({
  entityType,
  entityId,
  publicPath,
  onDone,
  onCancel,
}: {
  entityType: 'song' | 'arrangement' | 'stream'
  entityId: string
  publicPath: string | null
  onDone: () => void
  onCancel: () => void
}) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(): void {
    setFields({})
    setError(null)

    startTransition(async () => {
      const result = await addExternalMaterialAction({
        entityType,
        entityId,
        publicPath,
        values: { url: url.trim(), title: title.trim() || null },
      })

      if (!result.ok) {
        setFields(result.fields ?? {})
        if (!result.fields) setError(result.message)
        return
      }

      onDone()
    })
  }

  return (
    <div className="border-border rounded-xl border p-4">
      <p className="mb-3 text-sm font-medium">{strings.external.title}</p>

      <Field
        label={strings.external.url}
        htmlFor="external-url"
        hint={strings.external.hint}
        error={fields['values.url']}
      >
        <Input
          id="external-url"
          value={url}
          placeholder={strings.external.urlPlaceholder}
          onChange={(event) => setUrl(event.target.value)}
        />
      </Field>

      <Field label={strings.external.label} htmlFor="external-title" error={fields['values.title']}>
        <Input
          id="external-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>

      {error ? (
        <p role="alert" className="text-danger mb-3 text-sm">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={pending}>
          {strings.external.add}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          {strings.confirmRemove.cancel}
        </Button>
      </div>
    </div>
  )
}

/**
 * Подтверждение удаления.
 *
 * Спрашиваем всегда: восстановить загруженный файл нельзя, а промах
 * по кнопке на телефоне — обычное дело.
 */
function RemoveDialog({
  material,
  publicPath,
  onClose,
  onRemoved,
}: {
  material: EditorMaterial | null
  publicPath: string | null
  onClose: () => void
  onRemoved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function confirm(): void {
    if (!material) return
    setError(null)

    startTransition(async () => {
      const result = await deleteMaterialAction({ attachmentId: material.id, publicPath })

      if (!result.ok) {
        setError(result.message)
        return
      }

      onRemoved()
    })
  }

  return (
    <Dialog
      open={material !== null}
      onClose={onClose}
      title={strings.confirmRemove.title}
      description={strings.confirmRemove.description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {strings.confirmRemove.cancel}
          </Button>
          <Button variant="danger" onClick={confirm} disabled={pending}>
            {strings.confirmRemove.confirm}
          </Button>
        </>
      }
    >
      <p className="text-content-muted text-sm">{material?.displayTitle}</p>

      {error ? (
        <p role="alert" className="text-danger mt-3 text-sm">
          {error}
        </p>
      ) : null}
    </Dialog>
  )
}
