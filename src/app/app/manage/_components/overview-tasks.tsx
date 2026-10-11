import { AlertTriangle, ChevronRight } from 'lucide-react'
import Link from 'next/link'

import type { OverviewTask } from '../../_lib/manage-overview'

/**
 * Что требует внимания.
 *
 * Формулировка каждой строки — глаголом и с числом: «3 эфира ждут
 * записи», а не «Эфиры без записи: 3». Первое читается как задача,
 * второе — как отчёт, а отчёт ничего не побуждает сделать.
 *
 * Ниже строкой — что именно: два названия и «и ещё N». Полный список
 * здесь не нужен, за ним человек нажмёт на строку; но без единого
 * названия задача выглядит абстрактной, и её легко отложить.
 */
export function OverviewTasks({ tasks }: { tasks: OverviewTask[] }) {
  const sorted = [...tasks].sort((a, b) => weight(b) - weight(a))

  return (
    <section className="mt-8">
      <h2 className="font-display mb-3 text-lg font-bold">Требует внимания</h2>

      <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border">
        {sorted.map((task) => (
          <li key={task.id}>
            <Link
              href={task.href}
              className="hover:bg-surface-hover flex items-center gap-3 px-4 py-3 transition-colors"
            >
              {task.weight === 'high' ? (
                <AlertTriangle size={18} aria-hidden className="text-danger shrink-0" />
              ) : (
                <span className="border-border-strong h-2 w-2 shrink-0 rounded-full border" />
              )}

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{task.title}</span>
                <span className="text-content-muted block truncate text-xs">{task.hint}</span>
              </span>

              <ChevronRight size={16} aria-hidden className="text-content-subtle shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function weight(task: OverviewTask): number {
  return task.weight === 'high' ? 1 : 0
}
