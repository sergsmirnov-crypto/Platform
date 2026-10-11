import 'server-only'

import { requirePermission } from '@/modules/access'
import type { PublicationStatus } from '@/shared/db/enums'
import { errors } from '@/shared/errors'
import { slugify } from '@/shared/utils/slug'

import {
  deleteStreamRow,
  findCuratorOptions,
  findManagedStreams,
  findSongOptions,
  findSongsByIds,
  findStreamForEditing,
  findStreamsOverview,
  findStreamOwner,
  insertStream,
  replaceChapters,
  replaceStreamSongs,
  slugTaken,
  updateStream,
  updateStreamState,
  updateStreamStatus,
  updateStreamVideo,
} from './editor-repository'

import type { ChapterDraft } from './chapters'
import type { CuratorOption, EditorStream, ManagedStreamRow, SongOption } from './editor-repository'
import type { StreamInput } from './editor-schema'
import type { StreamState } from './schema'

/**
 * Правила редактирования эфиров.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОБЛАСТЬ ПРАВ «ТОЛЬКО СВОЙ» СЧИТАЕТСЯ ПО ВЕДУЩЕМУ
 *
 * У разборов владелец — тот, кто завёл разбор. У эфира владельцев
 * как бы двое: тот, кто создал карточку, и тот, кто ведёт. Правильный
 * ответ — ведущий: анонсы часто заводит один человек на всех, а правит
 * тему и выкладывает запись тот, кто эфир проводил.
 *
 * Поэтому проверка смотрит на ведущего, а на создателя — только пока
 * ведущий не назначен. Иначе куратор не мог бы править эфир, который
 * сам же и завёл пять минут назад.
 * ─────────────────────────────────────────────────────────────────
 *
 * Каждая функция начинается с `requirePermission`. Это не перестраховка:
 * скрытая в интерфейсе кнопка — удобство, а не защита (ARCHITECTURE §6).
 */

export type { CuratorOption, EditorStream, ManagedStreamRow, SongOption }

/**
 * Справочники для форм: кого можно поставить ведущим и какие разборы
 * связать с эфиром.
 *
 * Спрашиваются вместе с эфиром, одним заходом: два отдельных обращения
 * ради двух коротких списков — лишняя задержка на самом частом
 * для куратора экране.
 */
export async function getEditorOptions(
  actorId: string,
): Promise<{ curators: CuratorOption[]; songs: SongOption[] }> {
  await requirePermission(actorId, 'streams.view_drafts')

  const [curators, songs] = await Promise.all([findCuratorOptions(), findSongOptions(null, 500)])

  return { curators, songs }
}

/** Названия уже связанных песен — показать их без повторного поиска */
export async function getLinkedSongs(actorId: string, ids: string[]): Promise<SongOption[]> {
  await requirePermission(actorId, 'streams.view_drafts')

  return findSongsByIds(ids)
}

export async function getManagedStreams(
  actorId: string,
  filters: {
    status: PublicationStatus | null
    state: StreamState | null
    curatorId: string | null
    query: string | null
  },
): Promise<ManagedStreamRow[]> {
  await requirePermission(actorId, 'streams.view_drafts')

  return findManagedStreams(filters)
}

export async function getStreamForEditing(
  actorId: string,
  streamId: string,
): Promise<EditorStream> {
  await requirePermission(actorId, 'streams.view_drafts')

  const stream = await findStreamForEditing(streamId)
  if (!stream) throw errors.notFound('Эфир не найден')

  return stream
}

/** Создание. Всегда черновиком и всегда «запланирован» */
export async function createStream(actorId: string, values: StreamInput): Promise<string> {
  await requirePermission(actorId, 'streams.create')

  return insertStream({
    values,
    slug: await freeSlug(values.title),
    createdBy: actorId,
  })
}

export async function editStream(
  actorId: string,
  streamId: string,
  values: StreamInput,
): Promise<void> {
  await assertCanEditStream(actorId, streamId)

  // Адрес при переименовании не меняется намеренно: ссылку на анонс
  // куратор кидает в чат клуба за неделю до эфира, и она обязана
  // открываться и через год, когда на её месте лежит запись
  await updateStream(streamId, values)
}

/**
 * Смена этапа жизни: «скоро» → «идёт» → «запись».
 *
 * Переключает человек, а не расписание: эфир начинается на десять минут
 * позже, затягивается на полчаса или отменяется за пять минут до начала
 * (решение шага 7.1). Платформа подстраховывает только в одну сторону —
 * «идёт» дольше трёх часов сама превращается в «закончился».
 */
export async function setStreamState(
  actorId: string,
  streamId: string,
  state: StreamState,
): Promise<void> {
  await assertCanEditStream(actorId, streamId)
  await updateStreamState(streamId, state)
}

/**
 * Публикация.
 *
 * Единственная проверка — есть ли что показывать. Требовать запись
 * нельзя: анонс публикуется за неделю до эфира, когда записи нет
 * и быть не может. Требовать оглавление — тоже: его вписывают после
 * монтажа, а запись должна стать доступной сразу.
 */
export async function setStreamPublished(
  actorId: string,
  streamId: string,
  published: boolean,
): Promise<void> {
  const owner = await requireOwner(streamId)
  await requirePermission(actorId, 'streams.publish', ownerOf(owner))

  const stream = await findStreamForEditing(streamId)
  if (!stream) throw errors.notFound('Эфир не найден')

  if (published) {
    const blockers = findPublicationBlockers(stream)

    if (blockers.length > 0) {
      throw errors.validation(
        Object.fromEntries(blockers.map((blocker) => [blocker.field, blocker.message])),
      )
    }
  }

  await updateStreamStatus(streamId, published ? 'published' : 'draft')
}

/**
 * Чего не хватает для публикации.
 *
 * Список, а не первое найденное: куратор должен увидеть всё сразу,
 * а не чинить по одному, каждый раз нажимая «Опубликовать». Показывается
 * в редакторе до нажатия — «кураторы не публикуют» это риск №2 проекта,
 * и отказ в последний момент прямо на него работает.
 */
export type StreamBlocker = { field: string; message: string }

export function findPublicationBlockers(stream: {
  title: string
  state: StreamState
  joinUrl: string | null
  videoAssetId: string | null
}): StreamBlocker[] {
  const blockers: StreamBlocker[] = []

  if (stream.title.trim().length < 3) {
    blockers.push({ field: 'title', message: 'Укажите тему эфира' })
  }

  // Анонс без ссылки — это приглашение в никуда. У записи ссылка,
  // наоборот, не нужна: место, где эфир шёл, к этому времени закрыто
  if (stream.state === 'scheduled' && !stream.joinUrl) {
    blockers.push({ field: 'joinUrl', message: 'Укажите ссылку, куда приходить на эфир' })
  }

  if (stream.state === 'recorded' && !stream.videoAssetId) {
    blockers.push({
      field: 'video',
      message: 'У прошедшего эфира нет записи — приложите ролик или верните этап «идёт»',
    })
  }

  return blockers
}

export async function setStreamVideo(
  actorId: string,
  streamId: string,
  videoAssetId: string | null,
): Promise<void> {
  await assertCanEditStream(actorId, streamId)
  await updateStreamVideo(streamId, videoAssetId)
}

/** Оглавление сохраняется целиком: для куратора это один текст */
export async function saveChapters(
  actorId: string,
  streamId: string,
  chapters: ChapterDraft[],
): Promise<void> {
  await assertCanEditStream(actorId, streamId)
  await replaceChapters(streamId, chapters)
}

export async function saveStreamSongs(
  actorId: string,
  streamId: string,
  songIds: string[],
): Promise<void> {
  await assertCanEditStream(actorId, streamId)
  await replaceStreamSongs(streamId, songIds)
}

export async function removeStream(actorId: string, streamId: string): Promise<void> {
  const owner = await requireOwner(streamId)
  await requirePermission(actorId, 'streams.delete', ownerOf(owner))
  await deleteStreamRow(streamId)
}

/**
 * Может ли этот человек править этот эфир.
 *
 * Вынесено отдельно, потому что вызывается из семи мест, включая
 * реестр материалов в слое приложения: право положить конспект к эфиру —
 * это право править ЭТОТ эфир.
 */
export async function assertCanEditStream(actorId: string, streamId: string): Promise<void> {
  const owner = await requireOwner(streamId)
  await requirePermission(actorId, 'streams.edit', ownerOf(owner))
}

/**
 * Адрес и название эфира.
 *
 * Адрес нужен для сброса кэша страницы участника, название — журналу
 * действий. Оба спрашиваются ДО удаления: после него спрашивать
 * будет не у кого.
 */
export async function getStreamRef(
  streamId: string,
): Promise<{ slug: string; title: string; hasVideo: boolean }> {
  const owner = await requireOwner(streamId)

  // Наличие записи нужно оповещению: «запись готова» без записи —
  // худшее из возможных уведомлений
  return { slug: owner.slug, title: owner.title, hasVideo: owner.videoAssetId !== null }
}

async function requireOwner(streamId: string) {
  const owner = await findStreamOwner(streamId)
  if (!owner) throw errors.notFound('Эфир не найден')

  return owner
}

/** Ведущий, а пока он не назначен — тот, кто завёл карточку */
function ownerOf(owner: { curatorId: string | null; createdBy: string | null }): string | null {
  return owner.curatorId ?? owner.createdBy
}

/**
 * Свободный адрес.
 *
 * Тема на кириллице после перевода в латиницу может дать пустую строку —
 * тогда берём отметку времени. Некрасиво, но открывается; пустой адрес
 * не открывается вовсе.
 */
async function freeSlug(title: string): Promise<string> {
  const base = slugify(title) || `efir-${Date.now()}`

  if (!(await slugTaken(base))) return base

  // «Вопросы и ответы» проводятся каждый месяц, поэтому запас больше,
  // чем у разборов: два десятка одноимённых эфиров — обычное дело
  for (let suffix = 2; suffix <= 50; suffix += 1) {
    const candidate = `${base}-${suffix}`
    if (!(await slugTaken(candidate))) return candidate
  }

  return `${base}-${Date.now()}`
}

/** Сводка по эфирам для экрана «Обзор» (шаг 9.7) */
export async function getStreamsOverview(
  actorId: string,
  input: { publishedSince: Date; now: Date; limit: number },
) {
  await requirePermission(actorId, 'streams.view_drafts')

  return findStreamsOverview(input)
}
