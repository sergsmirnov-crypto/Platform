'use client'

import { Lock } from 'lucide-react'

import type { PermissionView } from '@/modules/access/team'
import type { PermissionEffect } from '@/modules/access/team-rules'
import { cn } from '@/ui/lib/cn'

/**
 * Один переключатель права. Три положения, а не два.
 *
 * ─────────────────────────────────────────────────────────────────
 * «ПО РОЛИ» — ЭТО НЕ «ВЫКЛЮЧЕНО»
 *
 * Право, выключенное принудительно, останется выключенным и после
 * смены роли. Право «по роли» поедет за ней. Свести их в один
 * переключатель — значит однажды повысить куратора до старшего
 * и не понять, почему он по-прежнему не видит курс.
 *
 * Поэтому положений три, и текущее подписано словом, а не оттенком
 * серого: настройка прав — не то место, где стоит угадывать.
 * ─────────────────────────────────────────────────────────────────
 */

const OPTIONS: { value: PermissionEffect; label: string }[] = [
  { value: 'inherit', label: 'По роли' },
  { value: 'grant', label: 'Включено' },
  { value: 'deny', label: 'Снято' },
]

type Props = {
  permission: PermissionView
  disabled: boolean
  onChange: (effect: PermissionEffect) => void
  onScopeChange: (scope: 'own' | 'all') => void
}

export function PermissionToggle({ permission, disabled, onChange, onScopeChange }: Props) {
  const locked = !permission.isEditable

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm">
          <span className={cn('truncate', locked && 'text-content-subtle')}>
            {permission.title}
          </span>

          {permission.isSensitive ? (
            <span className="text-danger text-xs" title="Право повышения привилегий">
              ⚠
            </span>
          ) : null}

          {permission.state.isOverridden ? (
            <span className="bg-accent-soft text-accent rounded px-1.5 py-0.5 text-xs">
              переопределено
            </span>
          ) : null}
        </p>

        {locked ? (
          <p className="text-content-subtle mt-0.5 flex items-center gap-1 text-xs">
            <Lock size={11} aria-hidden />
            {permission.lockReason}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {/* Область действия появляется только у включённого права
            с поддержкой own/all: у остальных выбирать нечего */}
        {permission.isScoped && permission.state.effect !== 'deny' && permission.state.scope ? (
          <select
            value={permission.state.scope}
            disabled={disabled || locked || permission.state.effect === 'inherit'}
            onChange={(event) => onScopeChange(event.target.value as 'own' | 'all')}
            className="border-border bg-surface rounded-md border px-2 py-1 text-xs disabled:opacity-50"
            aria-label={`Область действия: ${permission.title}`}
          >
            <option value="own">только свои</option>
            <option value="all">любые</option>
          </select>
        ) : null}

        <div
          role="radiogroup"
          aria-label={permission.title}
          className="border-border flex overflow-hidden rounded-md border"
        >
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={permission.state.effect === option.value}
              disabled={disabled || locked}
              onClick={() => onChange(option.value)}
              className={cn(
                'px-2.5 py-1 text-xs whitespace-nowrap transition-colors disabled:opacity-40',
                permission.state.effect === option.value
                  ? 'bg-accent text-accent-content'
                  : 'hover:bg-surface-hover',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
