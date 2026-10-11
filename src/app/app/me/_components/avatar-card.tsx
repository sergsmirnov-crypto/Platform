'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

import { removeAvatar } from '@/modules/identity/actions'
import { avatarUploadErrors } from '@/modules/identity/avatar'
import { identityStrings } from '@/modules/identity/strings'
import { UPLOAD_LIMITS } from '@/shared/storage/keys'
import { Avatar, Button, Dialog } from '@/ui'

/**
 * Фотография участника: показ, замена, удаление.
 *
 * Окно кадрирования подгружается только когда файл выбран. До этого
 * страница профиля остаётся такой же лёгкой, как была: человек заходит
 * сюда поправить город гораздо чаще, чем сменить фотографию.
 */

const strings = identityStrings.avatar

const AvatarEditor = dynamic(() => import('./avatar-editor'), { ssr: false })

type AvatarCardProps = {
  avatarUrl: string | null
  displayName: string
}

export function AvatarCard({ avatarUrl, displayName }: AvatarCardProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<Blob | null>(null)
  const [confirmingRemoval, setConfirmingRemoval] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0]

    // Поле сбрасывается сразу: иначе повторный выбор того же файла
    // не вызовет события, и человек решит, что кнопка сломалась
    event.target.value = ''

    if (!chosen) return

    // Быстрая проверка до чтения файла. Настоящая — на сервере;
    // эта нужна, чтобы не заставлять ждать зря
    if (chosen.size > UPLOAD_LIMITS.avatarBytes) {
      setError(avatarUploadErrors.tooLarge)
      return
    }

    setError(null)
    setFile(chosen)
  }

  function handleRemove() {
    setError(null)

    startTransition(async () => {
      const result = await removeAvatar({})

      if (!result.ok) {
        setError(result.message)
        return
      }

      setConfirmingRemoval(false)
      router.refresh()
    })
  }

  return (
    <section className="border-border bg-surface-raised mb-8 flex flex-wrap items-center gap-5 rounded-xl border p-5">
      <Avatar src={avatarUrl} alt={displayName} size="xl" />

      <div className="min-w-48 flex-1">
        <h2 className="font-display text-base font-bold">{strings.title}</h2>
        <p className="text-content-muted mt-1 text-sm">
          {avatarUrl ? strings.hint : strings.empty}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            size="sm"
            variant={avatarUrl ? 'secondary' : 'primary'}
            onClick={() => inputRef.current?.click()}
            disabled={pending}
          >
            {avatarUrl ? strings.replace : strings.upload}
          </Button>

          {avatarUrl ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmingRemoval(true)}
              disabled={pending}
            >
              {strings.remove}
            </Button>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-danger mt-3 text-sm">
            {error}
          </p>
        ) : null}
      </div>

      {/*
        Поле выбора файла скрыто, а нажимается кнопка дизайн-системы:
        внешний вид этого поля браузер не даёт изменить, и во всех
        браузерах он разный.
        `image/*` вместо перечисления форматов — чтобы телефон предложил
        снять фотографию сразу камерой, а айфон не прятал свои снимки
      */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChosen}
      />

      {file ? (
        <AvatarEditor
          file={file}
          onClose={() => setFile(null)}
          onSaved={() => {
            setFile(null)
            router.refresh()
          }}
        />
      ) : null}

      <Dialog
        open={confirmingRemoval}
        onClose={() => setConfirmingRemoval(false)}
        title={strings.confirmRemove.title}
        description={strings.confirmRemove.description}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmingRemoval(false)} disabled={pending}>
              {strings.confirmRemove.cancel}
            </Button>
            <Button variant="danger" onClick={handleRemove} disabled={pending}>
              {strings.confirmRemove.confirm}
            </Button>
          </>
        }
      >
        <div className="flex justify-center">
          <Avatar src={avatarUrl} alt={displayName} size="lg" />
        </div>
      </Dialog>
    </section>
  )
}
