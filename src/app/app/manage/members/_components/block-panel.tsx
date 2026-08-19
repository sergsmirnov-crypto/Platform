'use client'

import { Ban, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { directoryStrings } from '@/modules/identity/directory-strings'
import { MAX_BLOCK_REASON_LENGTH } from '@/modules/identity/moderation'
import type { ActionResult } from '@/shared/result'
import { Button, Dialog, Field, Textarea } from '@/ui'

import { blockMemberAction, unblockMemberAction } from '../_actions/moderation'

/**
 * Блокировка и снятие блокировки.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ОКНО С ПРИЧИНОЙ, А НЕ ПЕРЕКЛЮЧАТЕЛЬ
 *
 * Переключатель «заблокирован» щёлкается мимоходом и не спрашивает
 * ничего. Здесь нужно обратное: остановиться, прочитать, что за этим
 * последует, и объяснить, за что.
 *
 * Причина обязательна не ради формальности. Через полгода вопрос
 * «а почему он заблокирован» задаёт другой человек, и ответ должен
 * находиться в карточке, а не вспоминаться.
 * ─────────────────────────────────────────────────────────────────
 *
 * Снятие блокировки, наоборот, делается одной кнопкой без окна:
 * ошибиться в сторону «пустить человека обратно» не страшно.
 */

type Props = {
  userId: string
  isBlocked: boolean
}

export function BlockPanel({ userId, isBlocked }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<ActionResult<unknown>>) {
    setError(null)

    startTransition(async () => {
      const result = await action()

      if (!result.ok) {
        setError(result.message)
        return
      }

      setOpen(false)
      setReason('')
      router.refresh()
    })
  }

  if (isBlocked) {
    return (
      <div className="space-y-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => run(() => unblockMemberAction({ userId }))}
        >
          <ShieldCheck size={16} aria-hidden />
          {directoryStrings.block.unblock}
        </Button>

        <p className="text-content-subtle text-xs">{directoryStrings.block.unblockHint}</p>
        {error ? <p className="text-danger text-sm">{error}</p> : null}
      </div>
    )
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Ban size={16} aria-hidden />
        {directoryStrings.block.action}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={directoryStrings.block.title}
        description={directoryStrings.block.warning}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              {directoryStrings.block.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => run(() => blockMemberAction({ userId, reason }))}
            >
              {directoryStrings.block.confirm}
            </Button>
          </>
        }
      >
        <Field
          label={directoryStrings.block.reasonLabel}
          htmlFor="block-reason"
          hint={directoryStrings.block.reasonHint}
        >
          <Textarea
            id="block-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={MAX_BLOCK_REASON_LENGTH}
            rows={3}
            autoFocus
          />
        </Field>

        {error ? <p className="text-danger mt-3 text-sm">{error}</p> : null}
      </Dialog>
    </>
  )
}
