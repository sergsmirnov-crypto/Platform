import { notFound } from 'next/navigation'

import { mediaStrings } from '@/modules/media'
import { listMaterials } from '@/modules/media/materials-service'
import { findPublicationBlockers } from '@/modules/songs'
import { findAllTagsForEditor, findSongForEditor } from '@/modules/songs/editor-repository'
import { routes } from '@/shared/routes'
import { LinkButton } from '@/ui'

import { PageIntro } from '../../../_components/page-intro'
import { getViewer, viewerCan, viewerCanOn } from '../../../_lib/viewer'
import { MaterialsEditor } from '../../_components/materials-editor'
import { SongForm } from '../_components/song-form'

import { ArrangementEditor } from './_components/arrangement-editor'
import { PublishBar } from './_components/publish-bar'

type Props = { params: Promise<{ id: string }> }

/**
 * Редактор разбора.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОДНА СТРАНИЦА, А НЕ МАСТЕР
 *
 * Всё, что относится к разбору, лежит на одном экране сверху вниз:
 * песня → варианты → части каждого варианта → публикация. Куратор
 * возвращается к разбору по нескольку раз и каждый раз правит что-то
 * своё; мастер заставлял бы проходить его целиком ради одной опечатки
 * в названии части.
 *
 * Сохранение — по блокам, а не одной кнопкой внизу. Полчаса работы,
 * потерянные из-за случайно закрытой вкладки, — это тот опыт, после
 * которого куратор перестаёт публиковать разборы.
 * ─────────────────────────────────────────────────────────────────
 */
export default async function EditSongPage({ params }: Props) {
  const viewer = await getViewer()
  const { id } = await params

  const song = await findSongForEditor(id)
  if (!song) notFound()

  // Право на правку проверяется и здесь, и в каждом действии. Здесь —
  // чтобы не показывать форму, которую всё равно не дадут сохранить;
  // там — потому что скрытая кнопка защитой не является
  const owners = song.arrangements.map((arrangement) => arrangement.curatorId)
  const canEdit =
    viewerCan(viewer, 'songs.edit') &&
    (owners.length === 0 || owners.some((owner) => viewerCanOn(viewer, 'songs.edit', owner)))

  if (!canEdit) notFound()

  // Материалы обоих уровней забираются двумя запросами, а не «по одному
  // на вариант»: у разбора бывает четыре варианта, и четыре лишних
  // обращения к базе на каждое открытие редактора складываются в заметную
  // задержку ровно там, где куратор работает чаще всего
  const arrangementIds = song.arrangements.map((arrangement) => arrangement.id)

  const [tags, songMaterials, arrangementMaterials] = await Promise.all([
    findAllTagsForEditor(),
    listMaterials('song', [song.id]),
    listMaterials('arrangement', arrangementIds),
  ])

  const canUpload = viewerCan(viewer, 'media.upload')

  const blockers = findPublicationBlockers({
    title: song.title,
    artist: song.artist,
    arrangements: song.arrangements.map((arrangement) => ({
      status: arrangement.status,
      sectionCount: arrangement.sections.length,
    })),
  })

  return (
    <>
      <PageIntro title={song.title} />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <LinkButton href={routes.app.learn.song(song.slug)} variant="secondary" size="sm">
          Посмотреть глазами участника
        </LinkButton>
        <LinkButton href={routes.app.manage.songs()} variant="ghost" size="sm">
          Все разборы
        </LinkButton>
      </div>

      <PublishBar
        songId={song.id}
        slug={song.slug}
        title={song.title}
        artist={song.artist}
        status={song.status}
        blockers={blockers}
        canPublish={viewerCan(viewer, 'songs.publish')}
        canArchive={viewerCan(viewer, 'songs.delete')}
      />

      <section className="mt-12">
        <h2 className="font-display mb-6 text-xl font-bold">Песня</h2>
        <SongForm tags={tags} song={song} />
      </section>

      <section className="mt-14">
        <h2 className="font-display mb-2 text-xl font-bold">{mediaStrings.editor.title}</h2>
        <p className="text-content-muted mb-6 max-w-prose text-sm">
          Общие для всей песни: партитура целиком, минусовка. То, что относится к одному уровню
          сложности, кладётся внутрь варианта разбора.
        </p>

        <MaterialsEditor
          entityType="song"
          entityId={song.id}
          publicPath={routes.app.learn.song(song.slug)}
          materials={songMaterials.get(song.id) ?? []}
          canUpload={canUpload}
        />
      </section>

      <section className="mt-14">
        <h2 className="font-display mb-2 text-xl font-bold">Варианты разбора</h2>
        <p className="text-content-muted mb-6 max-w-prose text-sm">
          Один вариант — один уровень сложности. Вариантов одного уровня может быть несколько:
          например, на акустике и фингерстайлом.
        </p>

        <ArrangementEditor
          songId={song.id}
          publicPath={routes.app.learn.song(song.slug)}
          arrangements={song.arrangements}
          materials={Object.fromEntries(arrangementMaterials)}
          canPublish={viewerCan(viewer, 'songs.publish')}
          canDelete={viewerCan(viewer, 'songs.delete')}
          canUpload={canUpload}
        />
      </section>
    </>
  )
}
