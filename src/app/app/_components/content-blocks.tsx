import { Info, TriangleAlert } from 'lucide-react'
import Link from 'next/link'

import { courseStrings } from '@/modules/course'
import type { ContentBlock, LinkedSong } from '@/modules/course'
import { routes } from '@/shared/routes'
import { cn } from '@/ui'

/**
 * Отрисовка конспекта урока.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОДИН ВИД БЛОКА — ОДИН КОМПОНЕНТ
 *
 * Никакой разметки из базы: в `content` лежат данные, а не HTML,
 * и превратить их в страницу — работа React. Это то самое место,
 * ради которого выбран собственный формат блоков (ADR-0018): чужое
 * дерево пришлось бы либо обходить так же, либо вставлять как разметку.
 *
 * Неизвестные виды сюда не доезжают — их отбрасывает `parseContentBlocks`
 * при чтении. Поэтому здесь достаточно разобрать известные и ничего
 * не делать в остальных случаях.
 * ─────────────────────────────────────────────────────────────────
 */

type ContentBlocksProps = {
  blocks: ContentBlock[]
  /** Разборы, на которые ссылается урок, — по идентификатору */
  songs: LinkedSong[]
}

export function ContentBlocksView({ blocks, songs }: ContentBlocksProps) {
  const songById = new Map(songs.map((song) => [song.id, song]))

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => (
        <Block key={index} block={block} songById={songById} />
      ))}
    </div>
  )
}

function Block({ block, songById }: { block: ContentBlock; songById: Map<string, LinkedSong> }) {
  switch (block.type) {
    case 'heading':
      return <h3 className="font-display mt-8 text-lg font-bold first:mt-0">{block.text}</h3>

    case 'paragraph':
      return <p className="max-w-prose leading-relaxed">{block.text}</p>

    case 'list':
      return <List ordered={block.ordered} items={block.items} />

    case 'tip':
      return <Tip text={block.text} tone={block.tone} />

    case 'chords':
      return <Chords text={block.text} caption={block.caption} />

    case 'song':
      return <SongLink song={songById.get(block.songId)} note={block.note} />

    // Картинки и видео внутри конспекта появятся вместе с редактором
    // курса (6.4): загружать их сегодня некому, а рисовать заглушку
    // там, где содержимого не бывает, незачем
    case 'image':
    case 'video':
      return null
  }
}

function List({ ordered, items }: { ordered: boolean; items: string[] }) {
  const className = cn(
    'max-w-prose space-y-1.5 pl-5 leading-relaxed',
    ordered ? 'list-decimal' : 'list-disc',
  )

  return ordered ? (
    <ol className={className}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ol>
  ) : (
    <ul className={className}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}

/**
 * Врезка-совет.
 *
 * Два вида и разные значки, потому что говорят они разное: совет —
 * «так будет проще», предупреждение — «так вы навредите себе». Одним
 * оформлением на оба человек перестаёт замечать второе.
 */
function Tip({ text, tone }: { text: string; tone: 'tip' | 'warning' }) {
  const isWarning = tone === 'warning'
  const Icon = isWarning ? TriangleAlert : Info

  return (
    <aside
      className={cn(
        'flex max-w-prose gap-3 rounded-xl border p-4',
        isWarning ? 'border-danger/30 bg-danger/5' : 'border-border bg-surface-raised',
      )}
    >
      <Icon
        size={18}
        className={cn('mt-0.5 shrink-0', isWarning ? 'text-danger' : 'text-accent')}
        aria-hidden
      />
      <div>
        <p className="mb-1 text-sm font-semibold">
          {isWarning ? courseStrings.blocks.warning : courseStrings.blocks.tip}
        </p>
        <p className="text-sm leading-relaxed">{text}</p>
      </div>
    </aside>
  )
}

/**
 * Аккордовая сетка.
 *
 * Моноширинный шрифт, сохранение пробелов и горизонтальная прокрутка
 * вместо переноса строк. Перенос здесь недопустим: сетка из шести строк,
 * сложенная пополам на узком экране, перестаёт быть сеткой и становится
 * набором символов.
 */
function Chords({ text, caption }: { text: string; caption: string | null }) {
  return (
    <figure className="max-w-prose">
      <pre className="border-border bg-surface-sunken overflow-x-auto rounded-xl border p-4 font-mono text-sm leading-relaxed">
        {text}
      </pre>
      {caption ? (
        <figcaption className="text-content-muted mt-2 text-sm">{caption}</figcaption>
      ) : null}
    </figure>
  )
}

/**
 * Связанный разбор.
 *
 * Разбора может не оказаться: его сняли с публикации после того, как
 * куратор сослался на него из урока. Тогда блок просто не показывается —
 * это лучше, чем ссылка в никуда или сообщение об ошибке посреди
 * конспекта.
 */
function SongLink({ song, note }: { song: LinkedSong | undefined; note: string | null }) {
  if (!song) return null

  return (
    <Link
      href={routes.app.learn.song(song.slug)}
      className="border-border bg-surface-raised hover:border-border-strong block max-w-prose rounded-xl border p-4 transition-colors"
    >
      <p className="text-content-muted text-xs font-semibold tracking-wide uppercase">
        {courseStrings.lesson.relatedSong}
      </p>
      <p className="mt-1 font-medium">
        {song.artist} — {song.title}
      </p>
      {note ? <p className="text-content-muted mt-1 text-sm">{note}</p> : null}
    </Link>
  )
}
