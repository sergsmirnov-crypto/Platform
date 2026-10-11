/**
 * Одно число со страницы прогресса.
 *
 * Подпись под числом обязательна: «7» без пояснения не значит ничего,
 * а «7 · осталось 3» отвечает на вопрос, ради которого человек сюда
 * зашёл.
 */
export function ProgressStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="border-border bg-surface-raised rounded-xl border p-5">
      <p className="text-content-muted text-xs font-semibold tracking-wide uppercase">{label}</p>
      <p className="font-display mt-2 text-3xl font-bold tabular-nums">{value}</p>
      <p className="text-content-muted mt-1 text-sm">{hint}</p>
    </div>
  )
}
