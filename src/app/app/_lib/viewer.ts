import 'server-only'

import { cache } from 'react'

import { canActOn, getEffectivePermissions, hasPermission } from '@/modules/access'
import type { EffectivePermissions } from '@/modules/access'
import type { SessionContext } from '@/modules/identity'
import { getSession } from '@/modules/identity/current-user'
import type { ContentViewer } from '@/shared/content'

import { maskPermissions, isPreviewRequested, resolvePreviewState } from './preview'
import { readPreviewCookie } from './preview-cookie'

/**
 * Кто сейчас смотрит на платформу и что ему можно.
 *
 * ЕДИНСТВЕННОЕ МЕСТО ВО ВСЁМ ПРОЕКТЕ, где применяется маска режима
 * «смотреть как участник». Все страницы закрытой зоны спрашивают права
 * здесь и только здесь. Прямое обращение к `can` из модуля прав внутри
 * `src/app/` запрещено правилом линтера — иначе первая же страница,
 * забывшая про режим, покажет куратору черновик ровно тогда, когда он
 * проверяет, всё ли видно участнику.
 *
 * **Почему прослойка в слое приложения, а не правка модуля прав.**
 * Модуль `access` не знает и не должен знать о текущем запросе и cookie:
 * тот же модуль работает в процессе фоновых задач, где никакого браузера
 * нет. На этом уже обжигались на шаге 2.4, когда публичный вход модуля
 * `identity` затянул код Next.js и сломал запуск процесса задач.
 *
 * **О кэшировании.** Обёртка `cache` из React считает всё это один раз
 * за отрисовку страницы, сколько бы компонентов ни спросило.
 */

export type Viewer = {
  session: SessionContext | null
  userId: string | null

  /** Включён ли режим «смотреть как участник» */
  isPreview: boolean

  /**
   * Права, которыми пользуется интерфейс. В режиме просмотра — пустые.
   * Проверять через `viewerCan` / `viewerCanOn`.
   */
  permissions: EffectivePermissions

  /**
   * Есть ли управляющие права НА САМОМ ДЕЛЕ, независимо от режима.
   *
   * Нужно ровно для двух вещей: показать кнопку «Смотреть как участник»
   * тому, кому она осмысленна, и нарисовать полосу возврата. Для решений
   * о доступе не используется.
   */
  canManageInReality: boolean
}

export const getViewer = cache(async (): Promise<Viewer> => {
  const session = await getSession()

  if (!session) {
    return {
      session: null,
      userId: null,
      isPreview: false,
      permissions: new Map(),
      canManageInReality: false,
    }
  }

  const [real, rawCookie] = await Promise.all([
    getEffectivePermissions(session.user.id),
    readPreviewCookie(),
  ])

  const canManageInReality = real.size > 0

  const isPreview = resolvePreviewState({
    requested: isPreviewRequested(rawCookie),
    hasRealPermissions: canManageInReality,
  })

  return {
    session,
    userId: session.user.id,
    isPreview,
    permissions: maskPermissions(real, isPreview),
    canManageInReality,
  }
})

/**
 * Есть ли у смотрящего право вообще, безотносительно конкретного объекта.
 *
 * Синхронная: права к этому моменту уже загружены. Поэтому проверок
 * можно делать сколько угодно, не расставляя `await` по всей разметке.
 */
export function viewerCan(viewer: Viewer, permissionKey: string): boolean {
  return hasPermission(viewer.permissions, permissionKey)
}

/**
 * Может ли смотрящий выполнить действие над конкретным объектом.
 *
 * @param ownerId кто отвечает за объект: куратор разбора, автор новости.
 *                Нужен для прав с областью «только свой контент»
 */
export function viewerCanOn(
  viewer: Viewer,
  permissionKey: string,
  ownerId: string | null | undefined,
): boolean {
  if (!viewer.userId) return false
  return canActOn(viewer.permissions, permissionKey, ownerId, viewer.userId)
}

/**
 * Читатель содержимого: кто он и видит ли неопубликованное.
 *
 * ЕДИНСТВЕННЫЙ законный способ получить `ContentViewer`. Модули
 * содержимого — разборы, курс, эфиры, новости — принимают эту структуру
 * и сами прав не спрашивают: только здесь известно, включён ли режим
 * «смотреть как участник», и только здесь он учитывается.
 *
 * @param draftsPermission право видеть черновики в своём разделе:
 *        `songs.view_drafts`, `course.view_drafts`, `streams.view_drafts`
 *
 * Возвращает `null`, если человек не вошёл. Пустой идентификатор вместо
 * `null` был бы способом однажды показать черновики тому, у кого прав
 * нет вовсе.
 */
export async function getContentViewer(draftsPermission: string): Promise<ContentViewer | null> {
  const viewer = await getViewer()
  if (!viewer.userId) return null

  return {
    userId: viewer.userId,
    canSeeDrafts: viewerCan(viewer, draftsPermission),
  }
}

/**
 * ⚠️ Это проверка ДЛЯ ИНТЕРФЕЙСА, а не защита.
 *
 * Скрытая кнопка — удобство: обратиться к серверу можно и минуя интерфейс.
 * Любое действие, меняющее данные, по-прежнему начинается с
 * `requirePermission` из модуля прав, и оно смотрит на настоящие права,
 * а не на маскированные. Безопасность не должна зависеть от значения,
 * которое задаёт браузер, — даже когда эта зависимость безобидна.
 */
