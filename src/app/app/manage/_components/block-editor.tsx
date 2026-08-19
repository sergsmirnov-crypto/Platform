'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import type { ContentBlock, ContentBlockType } from '@/modules/course'
import { Button, Input, Textarea, cn } from '@/ui'

/**
 * Редактор блочного содержимого: конспект урока и текст новости.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ НЕ РЕДАКТОР «КАК В WORD»
 *
 * Содержимое урока хранится списком блоков, а не деревом стороннего
 * редактора (ADR-0018). Здесь это решение становится видимым: куратор
 * не печатает свободный текст с форматированием, а собирает урок
 * из готовых видов блоков.
 *
 * Плата честная: выделить слово жирным внутри абзаца нельзя.
 * Выигрыш — участник видит одинаково оформленный урок независимо
 * от того, кто его писал, а платформа не тащит в браузер сто килобайт
 * чужого кода ради трёх человек.
 * ─────────────────────────────────────────────────────────────────
 *
 * Компонент ничего не сохраняет сам: он держит список блоков и отдаёт
 * его наверх при каждом изменении. Сохранение — дело формы урока,
 * которая сохраняет заодно название и длительность одним действием.
 */

/** Виды блоков, которые куратор может добавить руками */
const ADDABLE: { type: ContentBlockType; label: string; hint: string }[] = [
  { type: 'paragraph', label: 'Абзац', hint: 'Обычный текст' },
  { type: 'heading', label: 'Заголовок', hint: 'Разделить урок на части' },
  { type: 'list', label: 'Список', hint: 'По пунктам' },
  { type: 'tip', label: 'Совет', hint: 'Врезка сбоку от текста' },
  { type: 'chords', label: 'Аккорды', hint: 'Сетка моноширинным шрифтом' },
]

type BlockEditorProps = {
  blocks: ContentBlock[]
  onChange: (blocks: ContentBlock[]) => void
}

export function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  const [adding, setAdding] = useState(false)

  function update(index: number, block: ContentBlock): void {
    onChange(blocks.map((item, position) => (position === index ? block : item)))
  }

  function remove(index: number): void {
    onChange(blocks.filter((_, position) => position !== index))
  }

  function move(index: number, direction: -1 | 1): void {
    const target = index + direction
    if (target < 0 || target >= blocks.length) return

    const next = [...blocks]
    const current = next[index] as ContentBlock
    next[index] = next[target] as ContentBlock
    next[target] = current

    onChange(next)
  }

  function add(type: ContentBlockType): void {
    setAdding(false)
    onChange([...blocks, emptyBlock(type)])
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => (
        <div key={index} className="border-border bg-surface-raised rounded-xl border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-content-muted text-xs font-semibold tracking-wide uppercase">
              {labelFor(block.type)}
            </span>

            <span className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                aria-label="Выше"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={16} aria-hidden />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Ниже"
                disabled={index === blocks.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={16} aria-hidden />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Удалить блок"
                onClick={() => remove(index)}
              >
                <Trash2 size={16} aria-hidden />
              </Button>
            </span>
          </div>

          <BlockFields block={block} onChange={(next) => update(index, next)} />
        </div>
      ))}

      {adding ? (
        <div className="border-border rounded-xl border border-dashed p-4">
          <p className="mb-3 text-sm font-medium">Что добавить</p>

          <div className="flex flex-wrap gap-2">
            {ADDABLE.map((option) => (
              <button
                key={option.type}
                type="button"
                onClick={() => add(option.type)}
                className="border-border hover:border-border-strong hover:bg-surface-hover rounded-lg border px-3 py-2 text-left transition-colors"
              >
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="text-content-muted block text-xs">{option.hint}</span>
              </button>
            ))}
          </div>

          <Button size="sm" variant="ghost" className="mt-3" onClick={() => setAdding(false)}>
            Отмена
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
          <Plus size={16} aria-hidden />
          Добавить блок
        </Button>
      )}
    </div>
  )
}

/**
 * Поля конкретного вида блока.
 *
 * Разбор по видам собран в одном месте: добавить вид блока — значит
 * дописать сюда одну ветку и одну строку в список выше. Ни сервер,
 * ни база при этом не меняются.
 */
function BlockFields({
  block,
  onChange,
}: {
  block: ContentBlock
  onChange: (block: ContentBlock) => void
}) {
  switch (block.type) {
    case 'heading':
      return (
        <Input
          value={block.text}
          placeholder="Заголовок"
          onChange={(event) => onChange({ ...block, text: event.target.value })}
        />
      )

    case 'paragraph':
      return (
        <Textarea
          value={block.text}
          rows={4}
          placeholder="Текст абзаца"
          onChange={(event) => onChange({ ...block, text: event.target.value })}
        />
      )

    case 'list':
      return (
        <div>
          {/* Пункты вводятся по строкам: заводить отдельное поле
              на каждый пункт значит заставлять человека нажимать
              «добавить» после каждой строчки */}
          <Textarea
            value={block.items.join('\n')}
            rows={4}
            placeholder={'Первый пункт\nВторой пункт'}
            onChange={(event) =>
              onChange({
                ...block,
                items: event.target.value.split('\n').map((line) => line.trim()),
              })
            }
          />

          <label className="text-content-muted mt-2 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.ordered}
              onChange={(event) => onChange({ ...block, ordered: event.target.checked })}
            />
            Нумеровать пункты
          </label>
        </div>
      )

    case 'tip':
      return (
        <div>
          <Textarea
            value={block.text}
            rows={3}
            placeholder="Текст врезки"
            onChange={(event) => onChange({ ...block, text: event.target.value })}
          />

          <div className="mt-2 flex gap-2">
            {(['tip', 'warning'] as const).map((tone) => (
              <button
                key={tone}
                type="button"
                onClick={() => onChange({ ...block, tone })}
                aria-pressed={block.tone === tone}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm transition-colors',
                  block.tone === tone
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-border text-content-muted hover:border-border-strong',
                )}
              >
                {tone === 'tip' ? 'Совет' : 'Осторожно'}
              </button>
            ))}
          </div>
        </div>
      )

    case 'chords':
      return (
        <div>
          <Textarea
            value={block.text}
            rows={6}
            className="font-mono"
            placeholder={'e|--0--\nB|--1--'}
            onChange={(event) => onChange({ ...block, text: event.target.value })}
          />
          <Input
            value={block.caption ?? ''}
            placeholder="Подпись, например «Am»"
            className="mt-2"
            onChange={(event) => onChange({ ...block, caption: event.target.value || null })}
          />
        </div>
      )

    // Картинки, видео и ссылки на разборы вводятся не текстом, поэтому
    // руками пока не добавляются. Уже существующие блоки такого вида
    // сохраняются как есть — редактор их не теряет
    case 'image':
    case 'video':
    case 'song':
      return (
        <p className="text-content-muted text-sm">
          Такой блок пока редактируется только через перенос содержимого. Он сохранится как есть.
        </p>
      )
  }
}

function labelFor(type: ContentBlockType): string {
  const known = ADDABLE.find((option) => option.type === type)
  if (known) return known.label

  return type === 'song' ? 'Связанный разбор' : type === 'image' ? 'Картинка' : 'Видео'
}

function emptyBlock(type: ContentBlockType): ContentBlock {
  switch (type) {
    case 'heading':
      return { type: 'heading', text: '' }
    case 'list':
      return { type: 'list', ordered: false, items: [''] }
    case 'tip':
      return { type: 'tip', text: '', tone: 'tip' }
    case 'chords':
      return { type: 'chords', text: '', caption: null }
    default:
      return { type: 'paragraph', text: '' }
  }
}
