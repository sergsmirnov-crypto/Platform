'use client'

import { Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { findChapterIssues, formatTimecode, parseTimecode, streamStrings } from '@/modules/streams'
import { Button, Input } from '@/ui'

import { saveChaptersAction } from '../../_actions/stream-editor'

/**
 * Редактор оглавления.
 *
 * ─────────────────────────────────────────────────────────────────
 * ГЛАВНЫЙ ЭКРАН ЭТОГО ШАГА
 *
 * Оглавление — то, ради чего архив вообще существует: полтора часа
 * записи превращаются в справочник. Но пишет его человек, отматывающий
 * запись в соседней вкладке, и делает это раз в неделю. Поэтому здесь
 * важна не полнота возможностей, а скорость набора.
 *
 * Что из этого следует:
 *   · время вводится текстом — «12:30», «1:02:15» или просто «750»;
 *   · Enter в поле названия добавляет следующую строку, так что
 *     десять пунктов набираются, не отрывая рук от клавиатуры;
 *   · порядок не задаётся вовсе — список выстраивается по времени сам
 *     (см. `normalizeChapters`), поэтому пункт, вспомненный последним,
 *     просто дописывается в конец;
 *   · ошибки показываются рядом со строкой сразу, а не после сохранения.
 * ─────────────────────────────────────────────────────────────────
 *
 * Автоподстановки времени из плеера здесь намеренно нет — решение
 * владельца продукта (ADR-0021). Куратор смотрит запись там, где ему
 * удобно, и переписывает время руками.
 */

type Row = {
  /** Ключ строки в списке: у несохранённых пунктов идентификатора ещё нет */
  key: string
  title: string
  timecode: string
}

type ChaptersEditorProps = {
  streamId: string
  chapters: { id: string; title: string; startSec: number }[]
  canEdit: boolean
}

export function ChaptersEditor({ streamId, chapters, canEdit }: ChaptersEditorProps) {
  const strings = streamStrings.manage.chapters
  const router = useRouter()

  const [rows, setRows] = useState<Row[]>(() =>
    chapters.map((chapter) => ({
      key: chapter.id,
      title: chapter.title,
      timecode: formatTimecode(chapter.startSec),
    })),
  )

  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const parsed = rows.map((row) => ({ title: row.title, startSec: parseTimecode(row.timecode) }))
  const issues = findChapterIssues(parsed)
  const filledCount = parsed.filter((row) => row.title.trim() && row.startSec !== null).length

  function update(key: string, patch: Partial<Row>): void {
    setSaved(false)
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function addRow(): void {
    setSaved(false)
    setRows((current) => [...current, { key: `new-${Date.now()}`, title: '', timecode: '' }])
  }

  function removeRow(key: string): void {
    setSaved(false)
    setRows((current) => current.filter((row) => row.key !== key))
  }

  function save(): void {
    setError(null)
    setSaved(false)

    // В базу уезжают только заполненные строки. Пустая строка внизу —
    // обычное состояние: человек нажал «добавить» и передумал
    const chaptersToSave = parsed
      .filter((row) => row.title.trim().length > 0 && row.startSec !== null)
      .map((row) => ({ title: row.title.trim(), startSec: row.startSec as number }))

    startTransition(async () => {
      const result = await saveChaptersAction({ streamId, chapters: chaptersToSave })

      if (!result.ok) {
        setError(result.message)
        return
      }

      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div>
      <p className="text-content-muted mb-4 text-sm">{strings.hint}</p>

      {rows.length === 0 ? (
        <p className="text-content-muted border-border mb-4 rounded-lg border border-dashed px-4 py-6 text-center text-sm">
          {strings.empty}
        </p>
      ) : (
        <ol className="mb-4 space-y-2">
          {rows.map((row, index) => {
            const issue = issues.find((item) => item.index === index)

            return (
              <li key={row.key} className="flex items-start gap-2">
                <div className="w-24 shrink-0">
                  <Input
                    value={row.timecode}
                    onChange={(event) => update(row.key, { timecode: event.target.value })}
                    placeholder={strings.timecodePlaceholder}
                    aria-label={`${strings.timecode}, пункт ${index + 1}`}
                    disabled={!canEdit}
                    inputMode="numeric"
                    className="tabular-nums"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <Input
                    value={row.title}
                    onChange={(event) => update(row.key, { title: event.target.value })}
                    placeholder={strings.namePlaceholder}
                    aria-label={`${strings.name}, пункт ${index + 1}`}
                    disabled={!canEdit}
                    onKeyDown={(event) => {
                      // Enter в последней строке добавляет следующую:
                      // оглавление набирается подряд, а не мышью
                      if (event.key === 'Enter' && index === rows.length - 1) {
                        event.preventDefault()
                        addRow()
                      }
                    }}
                  />

                  {issue ? <p className="text-danger mt-1 text-xs">{issue.message}</p> : null}
                </div>

                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    aria-label={`${strings.remove} ${index + 1}`}
                    className="text-content-subtle hover:text-danger flex size-11 shrink-0 items-center justify-center rounded-lg"
                  >
                    <X size={16} aria-hidden />
                  </button>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={addRow} disabled={pending}>
            <Plus size={16} aria-hidden />
            {strings.add}
          </Button>

          <Button onClick={save} disabled={pending}>
            {streamStrings.manage.save}
          </Button>

          <span className="text-content-muted text-sm">
            {saved ? strings.saved : strings.count(filledCount)}
          </span>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-danger mt-3 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
