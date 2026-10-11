'use client'

import { RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import type { TeamMemberSettings } from '@/modules/access/team'
import type { PermissionEffect } from '@/modules/access/team-rules'
import type { ActionResult } from '@/shared/result'
import { Button, Dialog } from '@/ui'

import { assignRoleAction, resetOverridesAction, setPermissionAction } from '../_actions/team'

import { PermissionToggle } from './permission-toggle'

/**
 * Панель «Настроить»: роль сверху, тонкая настройка ниже.
 *
 * ─────────────────────────────────────────────────────────────────
 * СНАЧАЛА РОЛЬ, ПОТОМ ИСКЛЮЧЕНИЯ
 *
 * В девяти случаях из десяти нужна только верхняя часть: выбрать
 * «Старший куратор» и закрыть. Поэтому список прав свёрнут — иначе
 * панель открывается сорока переключателями, и повседневное действие
 * начинает выглядеть как настройка сервера.
 *
 * Каждое изменение уходит на сервер сразу, без кнопки «Сохранить».
 * Причина простая: половина настроек здесь — отдельные независимые
 * решения, и общее «Сохранить» создало бы состояние «часть применилась,
 * часть нет» при первой же ошибке.
 * ─────────────────────────────────────────────────────────────────
 */

type Props = {
  member: { userId: string; displayName: string }
  settings: TeamMemberSettings
  onClose: () => void
}

export function PermissionsPanel({ member, settings, onClose }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const currentRole = settings.roles[0]?.code ?? null
  const hasOverrides = settings.overrides.added > 0 || settings.overrides.removed > 0

  function run(action: () => Promise<ActionResult<unknown>>) {
    setError(null)

    startTransition(async () => {
      const result = await action()

      if (!result.ok) {
        setError(result.message)
        return
      }

      router.refresh()
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={member.displayName}
      // Панель прав шире обычного окна: сорок переключателей в тридцати
      // ремах превращаются в лестницу из переносов
      className="w-[min(44rem,calc(100vw-2rem))]"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            disabled={pending || settings.roles.length === 0}
            onClick={() => run(() => assignRoleAction({ userId: member.userId, roleCode: null }))}
          >
            Убрать из команды
          </Button>

          <Button variant="secondary" onClick={onClose}>
            Готово
          </Button>
        </div>
      }
    >
      <section className="space-y-3">
        <h3 className="text-sm font-medium">Роль</h3>

        <div className="space-y-2">
          {settings.assignableRoles.map((role) => (
            <label
              key={role.code}
              className="border-border hover:bg-surface-hover flex cursor-pointer items-start gap-3 rounded-md border p-3"
            >
              <input
                type="radio"
                name="role"
                value={role.code}
                checked={currentRole === role.code}
                disabled={pending}
                onChange={() =>
                  run(() => assignRoleAction({ userId: member.userId, roleCode: role.code }))
                }
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{role.title}</span>
                <span className="text-content-muted block text-xs">{role.description}</span>
              </span>
            </label>
          ))}

          {/* Роли, которые текущий человек назначить не вправе, в списке
              отсутствуют — их отбирает сервер, а не эта разметка */}
          {settings.assignableRoles.length === 0 ? (
            <p className="text-content-subtle text-sm">
              Вы не можете менять роль этого человека: она не ниже вашей
            </p>
          ) : null}
        </div>
      </section>

      <section className="mt-6">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full items-center justify-between text-sm font-medium"
          aria-expanded={expanded}
        >
          <span>Тонкая настройка</span>
          <span className="text-content-muted text-xs">
            {hasOverrides
              ? `отклонений: ${settings.overrides.added + settings.overrides.removed}`
              : 'нет отклонений'}
            {expanded ? ' ▲' : ' ▼'}
          </span>
        </button>

        {expanded ? (
          <div className="mt-4 space-y-6">
            {hasOverrides ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => run(() => resetOverridesAction({ userId: member.userId }))}
              >
                <RotateCcw size={14} aria-hidden />
                Сбросить к роли
              </Button>
            ) : null}

            {settings.groups.map((group) => (
              <div key={group.key}>
                <h4 className="text-content-muted mb-1 text-xs tracking-wide uppercase">
                  {group.title}
                </h4>

                <div className="divide-border divide-y">
                  {group.permissions.map((permission) => (
                    <PermissionToggle
                      key={permission.key}
                      permission={permission}
                      disabled={pending}
                      onChange={(effect: PermissionEffect) =>
                        run(() =>
                          setPermissionAction({
                            userId: member.userId,
                            permissionKey: permission.key,
                            effect,
                            scope: permission.state.scope,
                          }),
                        )
                      }
                      onScopeChange={(scope) =>
                        run(() =>
                          setPermissionAction({
                            userId: member.userId,
                            permissionKey: permission.key,
                            effect: 'grant',
                            scope,
                          }),
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {error ? <p className="text-danger mt-4 text-sm">{error}</p> : null}
    </Dialog>
  )
}
