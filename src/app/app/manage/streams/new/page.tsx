import { streamStrings } from '@/modules/streams'
import { getEditorOptions } from '@/modules/streams/editor-service'

import { PageIntro } from '../../../_components/page-intro'
import { requireManagePermission } from '../../../_lib/guards'
import { StreamForm } from '../_components/stream-form'

export const metadata = { title: 'Новый эфир' }

/**
 * Создание эфира.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗДЕСЬ ТОЛЬКО АНОНС, БЕЗ ЗАПИСИ И ОГЛАВЛЕНИЯ
 *
 * Та же логика, что у разборов: короткая форма, после которой эфир
 * уже существует черновиком. Запись и оглавление появляются недели
 * через полторы — требовать их при создании было бы бессмысленно.
 *
 * Ведущим по умолчанию ставится тот, кто заводит карточку: чаще всего
 * это он и есть, а поменять — одно нажатие.
 * ─────────────────────────────────────────────────────────────────
 */
export default async function NewStreamPage() {
  const viewer = await requireManagePermission('streams.create')

  const { curators } = await getEditorOptions(viewer.userId)

  return (
    <>
      <PageIntro title={streamStrings.manage.create} />

      <p className="text-content-muted mb-8 max-w-prose">
        Достаточно темы и времени. Эфир сохранится черновиком — запись, оглавление и разобранные
        песни добавите потом, когда эфир пройдёт.
      </p>

      <StreamForm curators={curators} defaultCuratorId={viewer.userId} />
    </>
  )
}
