import { notFound } from 'next/navigation'

import { listMaterials } from '@/modules/media/materials-service'
import { streamStrings } from '@/modules/streams'
import {
  findPublicationBlockers,
  getEditorOptions,
  getLinkedSongs,
  getStreamForEditing,
} from '@/modules/streams/editor-service'
import { routes } from '@/shared/routes'
import { LinkButton } from '@/ui'

import { PageIntro } from '../../../_components/page-intro'
import { requireManagePermission } from '../../../_lib/guards'
import { viewerCan, viewerCanOn } from '../../../_lib/viewer'
import { MaterialsEditor } from '../../_components/materials-editor'
import { StreamForm } from '../_components/stream-form'

import { ChaptersEditor } from './_components/chapters-editor'
import { StreamSongsPicker } from './_components/stream-songs-picker'
import { StreamStatusBar } from './_components/stream-status-bar'
import { StreamVideo } from './_components/stream-video'

type Props = { params: Promise<{ id: string }> }

/**
 * Редактор эфира.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОДНА СТРАНИЦА СВЕРХУ ВНИЗ, ПО ХОДУ ЖИЗНИ ЭФИРА
 *
 * Блоки идут в том порядке, в каком к ним возвращается куратор:
 *
 *   свойства     — за неделю до эфира
 *   этап и показ — в день эфира
 *   запись       — после монтажа
 *   оглавление   — сразу за записью, отматывая её в соседней вкладке
 *   песни        — тогда же, по памяти
 *   материалы    — конспект, если он был
 *
 * Сохранение — по блокам, а не одной кнопкой внизу. Полчаса работы,
 * потерянные из-за случайно закрытой вкладки, — это тот опыт, после
 * которого куратор перестаёт выкладывать записи.
 * ─────────────────────────────────────────────────────────────────
 */
export default async function EditStreamPage({ params }: Props) {
  const viewer = await requireManagePermission('streams.view_drafts')
  const { id } = await params

  const stream = await getStreamForEditing(viewer.userId, id).catch(() => null)
  if (!stream) notFound()

  // Владелец — ведущий, а пока он не назначен, тот, кто завёл карточку.
  // Право проверяется и здесь, и в каждом действии: здесь — чтобы
  // не показывать поля, которые всё равно не дадут сохранить,
  // там — потому что скрытая кнопка защитой не является
  const owner = stream.curatorId ?? stream.createdBy
  const canEdit = viewerCanOn(viewer, 'streams.edit', owner)
  const canPublish = viewerCanOn(viewer, 'streams.publish', owner)
  const canDelete = viewerCanOn(viewer, 'streams.delete', owner)

  const [options, linkedSongs, materials] = await Promise.all([
    getEditorOptions(viewer.userId),
    getLinkedSongs(viewer.userId, stream.songIds),
    listMaterials('stream', [stream.id]),
  ])

  const blockers = findPublicationBlockers(stream)

  return (
    <>
      <PageIntro
        title={stream.title}
        actions={
          <LinkButton href={routes.app.streams.stream(stream.slug)} variant="secondary" size="sm">
            {streamStrings.manage.openForMembers}
          </LinkButton>
        }
      />

      <div className="mt-8 space-y-10">
        <StreamStatusBar
          streamId={stream.id}
          state={stream.state}
          status={stream.status}
          blockers={blockers}
          canEdit={canEdit}
          canPublish={canPublish}
          canDelete={canDelete}
        />

        <section>
          <SectionTitle>Свойства</SectionTitle>
          {canEdit ? <StreamForm curators={options.curators} stream={stream} /> : <ReadOnlyNote />}
        </section>

        <section>
          <SectionTitle>{streamStrings.manage.video.title}</SectionTitle>
          <StreamVideo streamId={stream.id} externalId={stream.videoExternalId} canEdit={canEdit} />
        </section>

        <section>
          <SectionTitle>{streamStrings.manage.chapters.title}</SectionTitle>
          <ChaptersEditor streamId={stream.id} chapters={stream.chapters} canEdit={canEdit} />
        </section>

        <section>
          <SectionTitle>{streamStrings.manage.songs.title}</SectionTitle>
          <StreamSongsPicker
            streamId={stream.id}
            songs={linkedSongs}
            options={options.songs}
            canEdit={canEdit}
          />
        </section>

        <section>
          <SectionTitle>Материалы</SectionTitle>
          <MaterialsEditor
            entityType="stream"
            entityId={stream.id}
            publicPath={routes.app.streams.stream(stream.slug)}
            materials={materials.get(stream.id) ?? []}
            canUpload={canEdit && viewerCan(viewer, 'media.upload')}
          />
        </section>
      </div>
    </>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display mb-4 text-xl font-bold">{children}</h2>
}

/**
 * Пояснение вместо формы.
 *
 * Куратор с областью «только свой» видит чужой эфир целиком, но правит
 * лишь свои. Пустое место на этой странице заставило бы гадать, сломалось
 * ли что-то; одна строка отвечает на вопрос сразу.
 */
function ReadOnlyNote() {
  return (
    <p className="text-content-muted border-border rounded-lg border border-dashed px-4 py-6 text-sm">
      Этот эфир ведёт другой куратор — править его свойства нельзя.
    </p>
  )
}
