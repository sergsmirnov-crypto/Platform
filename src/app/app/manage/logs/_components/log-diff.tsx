import { logStrings } from '@/modules/audit'

/**
 * Что именно изменилось.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ЭТО СПРЯТАНО ПОД РАСКРЫТИЕ
 *
 * Подробности нужны в одной записи из двадцати — обычно достаточно
 * «кто, что и когда». Показывать их всегда значит превратить ленту
 * в простыню и потерять её главное свойство: пробегаться глазами.
 *
 * `details` вместо переключателя на состоянии — потому что это
 * умеет сам браузер: ни JavaScript, ни клиентского компонента,
 * работает при выключенных скриптах и доступно с клавиатуры.
 * ─────────────────────────────────────────────────────────────────
 *
 * Незнакомые поля не прячутся: показывается ключ как есть. Запись,
 * сделанная новым кодом до того, как поле получило человеческое
 * название, останется читаемой — а спрятанная не оставила бы следа.
 */

const FIELDS: Record<string, string> = logStrings.diffFields
const VALUES: Record<string, string> = logStrings.diffValues

export function LogDiff({ diff }: { diff: Record<string, unknown> | null }) {
  const entries = Object.entries(diff ?? {}).filter(([, value]) => value !== undefined)

  if (entries.length === 0) return null

  return (
    <details className="group mt-1">
      <summary className="text-content-subtle hover:text-content-muted ml-13 inline-flex cursor-pointer list-none text-xs">
        {logStrings.entry.details}
      </summary>

      <dl className="text-content-muted mt-1 ml-13 space-y-0.5 text-xs">
        {entries.map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <dt className="text-content-subtle shrink-0">{FIELDS[key] ?? key}</dt>
            <dd className="min-w-0 break-words">{formatValue(value)}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

/**
 * Приводит значение к читаемому виду.
 *
 * Списки — через запятую: в журнале они всегда короткие (роли, ключи
 * прав). Всё непонятное показывается как есть: лучше техническая
 * строка, чем пустое место на месте единственной нужной подробности.
 */
function formatValue(value: unknown): string {
  if (value === null || value === '') return VALUES.empty ?? 'пусто'
  if (typeof value === 'boolean') return value ? 'да' : 'нет'

  if (Array.isArray(value)) {
    if (value.length === 0) return VALUES.empty ?? 'пусто'

    return value.map((item) => formatValue(item)).join(', ')
  }

  if (typeof value === 'string') return VALUES[value] ?? value
  if (typeof value === 'number') return String(value)

  return JSON.stringify(value)
}
