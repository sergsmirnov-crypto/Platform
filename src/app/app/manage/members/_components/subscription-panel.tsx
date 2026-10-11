'use client'

import { KeyRound, ShieldOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

// Из листового файла, а не из публичного входа модуля: тот тянет
// за собой запросы к базе с пометкой `server-only`
import { subscriptionStrings } from '@/modules/subscription/strings'
import type { ActionResult } from '@/shared/result'
import { Button, Dialog, Field, Input, Textarea } from '@/ui'

import { grantAccessAction, revokeAccessAction } from '../_actions/subscription'

/**
 * Ручная выдача и отзыв доступа.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЖИВЁТ НА КАРТОЧКЕ УЧАСТНИКА, А НЕ НА ЭКРАНЕ ПОДПИСОК
 *
 * Повод для ручного вмешательства всегда один: конкретный человек
 * написал, что заплатил, а доступа нет. Разбираться с ним приходят
 * в его карточку — там видно и подписку, и последний вход, и роли.
 *
 * Список подписок отвечает на другой вопрос — «что происходит
 * с подписками вообще», — и кнопка выдачи в нём соблазняла бы решать
 * частные случаи, не открыв человека.
 * ─────────────────────────────────────────────────────────────────
 */

type Mode = 'grant' | 'revoke'

export function SubscriptionPanel({ userId, hasAccess }: { userId: string; hasAccess: boolean }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode | null>(null)
  const [reason, setReason] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function close() {
    setMode(null)
    setReason('')
    setValidUntil('')
    setError(null)
  }

  function run(action: () => Promise<ActionResult<unknown>>) {
    setError(null)

    startTransition(async () => {
      const result = await action()

      if (!result.ok) {
        setError(result.message)
        return
      }

      close()
      router.refresh()
    })
  }

  const strings = subscriptionStrings.manage

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" onClick={() => setMode('grant')}>
          <KeyRound size={16} aria-hidden />
          {strings.grant}
        </Button>

        {hasAccess ? (
          <Button variant="ghost" onClick={() => setMode('revoke')}>
            <ShieldOff size={16} aria-hidden />
            {strings.revoke}
          </Button>
        ) : null}
      </div>

      {mode ? (
        <Dialog
          open
          onClose={close}
          title={mode === 'grant' ? strings.grantPanel.title : strings.revokePanel.title}
          description={mode === 'grant' ? strings.grantPanel.warning : strings.revokePanel.warning}
          footer={
            <>
              <Button variant="ghost" onClick={close} disabled={pending}>
                Отмена
              </Button>
              <Button
                variant={mode === 'grant' ? 'primary' : 'danger'}
                disabled={pending}
                onClick={() =>
                  run(() =>
                    mode === 'grant'
                      ? grantAccessAction({ userId, reason, validUntil: validUntil || null })
                      : revokeAccessAction({ userId, reason }),
                  )
                }
              >
                {mode === 'grant' ? strings.grant : strings.revoke}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label={strings.reasonLabel} htmlFor="sub-reason" hint={strings.reasonRequired}>
              <Textarea
                id="sub-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                autoFocus
              />
            </Field>

            {mode === 'grant' ? (
              <Field
                label={strings.validUntilLabel}
                htmlFor="sub-valid-until"
                hint={strings.grantPanel.validUntilHint}
              >
                <Input
                  id="sub-valid-until"
                  type="date"
                  value={validUntil}
                  onChange={(event) => setValidUntil(event.target.value)}
                />
              </Field>
            ) : null}

            {error ? <p className="text-danger text-sm">{error}</p> : null}
          </div>
        </Dialog>
      ) : null}
    </>
  )
}
