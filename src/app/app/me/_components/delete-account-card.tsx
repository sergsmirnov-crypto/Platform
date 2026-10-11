'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { deleteAccountAction } from '@/modules/identity/actions'
import { identityStrings } from '@/modules/identity/strings'
import { routes } from '@/shared/routes'
import { Button, Card, CardBody, CardTitle, Dialog, Field, Input } from '@/ui'

/**
 * Удаление аккаунта.
 *
 * Самое необратимое действие на платформе, поэтому оно устроено сложнее,
 * чем могло бы: отдельная карточка внизу страницы, окно подтверждения
 * и слово, которое нужно ввести руками. Галочки «я понимаю» здесь мало —
 * её ставят не читая.
 *
 * Про подписку сказано прямым текстом и до нажатия. Платформа не может
 * остановить списания: деньги идут через бота в Telegram, и человек,
 * удаливший аккаунт в уверенности, что этим всё закончилось, обнаружит
 * списание через месяц.
 */

const strings = identityStrings.settings.deleteAccount

type DeleteAccountCardProps = {
  /** Единственный владелец платформы удалить себя не может */
  blocked: boolean
}

export function DeleteAccountCard({ blocked }: DeleteAccountCardProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const matches = confirmation.trim().toUpperCase() === strings.confirmWord

  function handleDelete() {
    setError(null)

    startTransition(async () => {
      const result = await deleteAccountAction({ confirmation: confirmation.trim().toUpperCase() })

      if (!result.ok) {
        setError(result.fields?.confirmation ?? result.message)
        return
      }

      // Сессии больше нет, поэтому обычный переход внутри платформы
      // приведёт к перенаправлению на вход. Уходим сразу на лендинг
      router.replace(routes.home())
      router.refresh()
    })
  }

  return (
    <Card className="border-danger/40">
      <CardBody>
        <CardTitle>{strings.title}</CardTitle>
        <p className="text-content-muted mt-1 text-sm">{strings.description}</p>
        <p className="text-content mt-3 text-sm">{strings.subscriptionWarning}</p>

        {blocked ? (
          <p className="text-content-muted mt-4 text-sm">{strings.lastOwner}</p>
        ) : (
          <div className="mt-4">
            <Button size="sm" variant="danger" onClick={() => setOpen(true)}>
              {strings.action}
            </Button>
          </div>
        )}
      </CardBody>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
          setConfirmation('')
          setError(null)
        }}
        title={strings.confirmTitle}
        description={strings.confirmDescription}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              {strings.cancel}
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={pending || !matches}>
              {pending ? 'Удаляю…' : strings.action}
            </Button>
          </>
        }
      >
        <p className="text-content mb-4 text-sm">{strings.subscriptionWarning}</p>

        <Field
          label={strings.confirmLabel}
          htmlFor="delete-confirmation"
          error={error ?? undefined}
        >
          <Input
            id="delete-confirmation"
            value={confirmation}
            autoComplete="off"
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={pending}
            aria-invalid={Boolean(error)}
          />
        </Field>
      </Dialog>
    </Card>
  )
}
