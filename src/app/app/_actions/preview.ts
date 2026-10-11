'use server'

import { redirect } from 'next/navigation'

import { AUDIT_ACTIONS, recordAudit } from '@/modules/audit'
import { routes } from '@/shared/routes'

import { pathAfterPreviewChange } from '../_lib/preview'
import { clearPreviewCookie, setPreviewCookie } from '../_lib/preview-cookie'
import { getViewer } from '../_lib/viewer'

/**
 * Вход и выход из режима «смотреть как участник».
 *
 * Обычные функции, а не обёртка `defineAction`: внутри вызывается
 * `redirect`, который бросает специальное исключение — обёртка приняла бы
 * его за ошибку. Тот же приём уже используется у выхода из аккаунта.
 *
 * Адрес текущей страницы приходит из формы: серверное действие не знает,
 * с какой страницы его вызвали. Значение проверяется в
 * `pathAfterPreviewChange` — принимаются только внутренние пути.
 */

function readPath(formData: FormData): string | null {
  const value = formData.get('path')
  return typeof value === 'string' ? value : null
}

/**
 * Включает режим.
 *
 * Тому, у кого управляющих прав нет, включать нечего: режим для него
 * ничего не изменит, а запись в журнале будет мусорной.
 */
export async function enterViewAsMember(formData: FormData): Promise<void> {
  const viewer = await getViewer()

  if (!viewer.userId || !viewer.canManageInReality) {
    redirect(routes.app.dashboard())
  }

  await setPreviewCookie()
  await recordAudit({ actorId: viewer.userId, action: AUDIT_ACTIONS.previewEnter })

  redirect(pathAfterPreviewChange(readPath(formData), true))
}

/**
 * Выключает режим.
 *
 * Выход разрешён всегда и никаких прав не требует: единственное, что он
 * делает, — снимает добровольное ограничение. Человек без прав от этого
 * ничего не получит.
 */
export async function exitViewAsMember(formData: FormData): Promise<void> {
  const viewer = await getViewer()

  await clearPreviewCookie()

  if (viewer.userId && viewer.isPreview) {
    await recordAudit({ actorId: viewer.userId, action: AUDIT_ACTIONS.previewExit })
  }

  redirect(pathAfterPreviewChange(readPath(formData), false))
}
