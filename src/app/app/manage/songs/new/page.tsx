import { notFound } from 'next/navigation'

import { findAllTagsForEditor } from '@/modules/songs/editor-repository'

import { PageIntro } from '../../../_components/page-intro'
import { getViewer, viewerCan } from '../../../_lib/viewer'
import { SongForm } from '../_components/song-form'

export const metadata = { title: 'Новый разбор' }

/**
 * Создание разбора.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗДЕСЬ ТОЛЬКО ПЕСНЯ, БЕЗ ВАРИАНТОВ И ЧАСТЕЙ
 *
 * Соблазн — сделать мастер из пяти шагов: песня, вариант, части,
 * материалы, публикация. Так это и описано в первом наброске (PRD §4.7).
 *
 * Но мастер требует пройти его до конца, а куратор заводит разбор
 * в перерыве между делами: записал название, ушёл, вернулся вечером.
 * Поэтому создание — это одна короткая форма из двух обязательных полей,
 * после которой разбор УЖЕ существует черновиком. Всё остальное
 * добавляется на странице редактирования, в любом порядке и когда угодно.
 *
 * Цена — на одно нажатие больше у того, кто заводит разбор целиком
 * за один присест. Выгода — разбор не теряется, если человека отвлекли.
 * ─────────────────────────────────────────────────────────────────
 */
export default async function NewSongPage() {
  const viewer = await getViewer()
  if (!viewerCan(viewer, 'songs.create')) notFound()

  const tags = await findAllTagsForEditor()

  return (
    <>
      <PageIntro title="Новый разбор" />

      <p className="text-content-muted mb-8 max-w-prose">
        Достаточно названия и исполнителя. Разбор сохранится черновиком — варианты, части и
        материалы добавите следующим шагом.
      </p>

      <SongForm tags={tags} />
    </>
  )
}
