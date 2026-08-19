import { libraryStrings } from '@/modules/library'
import { routes } from '@/shared/routes'
import { EmptyState, LinkButton } from '@/ui'

import { PageIntro } from '../../_components/page-intro'
import { findNoteGroups, getNoteViewers } from '../../_lib/notes'

import { NoteGroups } from './_components/note-groups'

export const metadata = { title: libraryStrings.notes.title }

/**
 * Мои заметки.
 *
 * Отвечает на вопрос «где я в прошлый раз застрял». Группы идут
 * в порядке последнего изменения: сверху то, чем человек занимался
 * недавно, — а занимался он, скорее всего, тем же самым.
 *
 * Заметки к снятому с публикации разбору не показываются, но и не
 * удаляются: разбор могут вернуть, и заметки вернутся вместе с ним.
 */
export default async function NotesPage() {
  const viewers = await getNoteViewers()
  if (!viewers) return null

  const groups = await findNoteGroups(viewers)
  const total = groups.reduce((sum, group) => sum + group.notes.length, 0)

  return (
    <>
      <PageIntro
        title={libraryStrings.notes.title}
        description={libraryStrings.notes.description}
        actions={
          total > 0 ? (
            <span className="text-content-muted text-sm">{libraryStrings.notes.total(total)}</span>
          ) : undefined
        }
      />

      {groups.length > 0 ? (
        <NoteGroups groups={groups} />
      ) : (
        <EmptyState
          title={libraryStrings.notes.pageEmpty}
          description={libraryStrings.notes.pageEmptyDescription}
          action={
            <LinkButton href={routes.app.learn.songs()}>
              {libraryStrings.notes.pageEmptyAction}
            </LinkButton>
          }
          className="border-border mt-8 rounded-lg border border-dashed"
        />
      )}
    </>
  )
}
