import { notFound, redirect } from 'next/navigation'

import { hasPermission } from '@/modules/access'
import type { SessionContext } from '@/modules/identity'
import { isOnboardingDone } from '@/modules/identity'
import { getSession } from '@/modules/identity/current-user'
import { findOnboardingState } from '@/modules/identity/repository'
import { missingLegalDocuments } from '@/modules/legal/service'
import { getAccessStatus } from '@/modules/subscription'
import type { AccessStatus } from '@/modules/subscription'
import { RETURN_TO_PARAM } from '@/shared/config/constants'
import { AUTH_ENABLED } from '@/shared/config/features'
import { routes } from '@/shared/routes'

import { MANAGE_NAV } from './navigation'
import { getViewer, viewerCan } from './viewer'

import type { NavChild } from './navigation'
import type { Viewer } from './viewer'

/**
 * Проверки доступа к закрытой зоне.
 *
 * Живут в слое приложения, а не в модуле, намеренно. Здесь встречаются три
 * разных модуля — вход, права и подписка — и решается, что показать человеку.
 * Это и есть работа слоя приложения: модули отвечают на вопросы, страницы
 * складывают ответы в поведение.
 *
 * Второе соображение: перенаправление — понятие Next.js. Модули о нём знать
 * не должны, иначе их нельзя будет использовать в фоновых задачах.
 *
 * ⚠️ Это проверка на сервере, а не в middleware. Middleware делает только
 * дешёвый редирект по наличию cookie и границей безопасности не является
 * (ADR-0003, CVE-2025-29927).
 */

/**
 * Требует действующую сессию.
 *
 * Человека без сессии отправляет на вход, запоминая, куда он шёл:
 * после входа он попадёт туда, а не на главную.
 */
export async function requireMember(currentPath: string): Promise<SessionContext | null> {
  // Пока проверка входа выключена, закрытая зона открыта: иначе каркас
  // страниц невозможно посмотреть. В производственной среде это значение
  // обязано быть включено — приложение иначе не запустится.
  if (!AUTH_ENABLED) return null

  const session = await getSession()

  if (!session) {
    const target = new URL(routes.home(), 'http://internal')
    target.searchParams.set(RETURN_TO_PARAM, currentPath)
    redirect(`${target.pathname}${target.search}`)
  }

  return session
}

/**
 * Требует действующую подписку.
 *
 * Вызывается в разметке платных разделов. Человека без подписки уводит
 * на экран продления — но не выкидывает из платформы: профиль, прогресс
 * и страницы клуба остаются ему доступны (PRD v0.1 §2.2).
 */
export async function requireActiveSubscription(userId: string): Promise<AccessStatus> {
  const access = await getAccessStatus(userId)

  if (!access.hasAccess) {
    redirect(routes.app.subscriptionExpired())
  }

  return access
}

/**
 * Состояние доступа без перенаправления.
 *
 * Нужно там, где содержимое показывается всем, но выглядит по-разному:
 * например, каталог разборов открыт, а кнопка просмотра — нет.
 */
export async function getAccessForCurrentUser(): Promise<AccessStatus | null> {
  const session = await getSession()
  if (!session) return null

  return getAccessStatus(session.user.id)
}

/**
 * Требует доступ к разделу «Управление».
 *
 * Проверяет НАСТОЯЩИЕ права, без учёта режима просмотра: попавший
 * в раздел в режиме получает объяснение и кнопку возврата, а не молчаливое
 * перенаправление, из которого непонятно, что произошло. Разбор этого
 * случая — в разметке раздела.
 *
 * Проверка грубая: «есть хотя бы одно управляющее право». Точная проверка
 * каждой страницы появится на Этапе 9 вместе с их содержимым — сейчас
 * там заглушки, и проверять на них нечего.
 */
export async function requireManageAccess(): Promise<void> {
  const viewer = await getViewer()

  if (!viewer.canManageInReality) {
    redirect(routes.app.dashboard())
  }
}

/**
 * Требует конкретное право на странице управления.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ «СТРАНИЦЫ НЕ СУЩЕСТВУЕТ», А НЕ «НЕТ ДОСТУПА»
 *
 * Человек попадает сюда только по прямой ссылке: пункта меню у него нет.
 * Сообщение «нет доступа» на такой странице отвечает на вопрос, которого
 * он не задавал, и заодно подтверждает, что раздел существует.
 * «Страница не найдена» — короче и честнее.
 * ─────────────────────────────────────────────────────────────────
 *
 * Возвращает смотрящего: почти каждой странице он нужен дальше — решить,
 * показывать ли кнопку удаления или соседний блок.
 *
 * ⚠️ Для страницы это полноценная защита: серверный компонент выполняется
 * на сервере. Для ДЕЙСТВИЙ, меняющих данные, этого мало — они начинаются
 * с `requirePermission` в своём модуле, как и раньше (ARCHITECTURE §6).
 */
export async function requireManagePermission(
  permissionKey: string,
): Promise<Viewer & { userId: string }> {
  const viewer = await getViewer()

  if (!viewer.userId || !viewerCan(viewer, permissionKey)) notFound()

  // Тип сужается намеренно: дальше на странице `viewer.userId` передаётся
  // в сервисы, и без сужения каждая страница дописывала бы к нему
  // восклицательный знак — то есть обещала бы то, что уже проверено здесь
  return viewer as Viewer & { userId: string }
}

/**
 * Пункты раздела «Управление», доступные этому человеку.
 *
 * Пункт показывается только обладателю соответствующего права. Пустой
 * список означает, что раздела в меню не будет вовсе, — и это же случается
 * в режиме «смотреть как участник», где прав не остаётся.
 *
 * Права проверяются здесь ради интерфейса. Настоящая защита — на каждой
 * странице управления отдельно: скрытая кнопка удобна, но защитой не является.
 */
export async function getVisibleManageItems(): Promise<NavChild[]> {
  const viewer = await getViewer()

  if (!viewer.userId) return []

  const allowed = MANAGE_NAV.filter(
    (item) => item.permission && hasPermission(viewer.permissions, item.permission),
  )

  // Обзор показываем только если есть хоть что-то ещё: иначе человек
  // попадёт в раздел, где ему нечего делать
  if (allowed.length === 0) return []

  const overview = MANAGE_NAV[0]
  return overview ? [overview, ...allowed] : allowed
}

/**
 * Отправляет на знакомство того, кто его не прошёл.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОРЯДОК ПРОВЕРОК И ПОЧЕМУ ОН ИМЕННО ТАКОЙ
 *
 *   сессия → согласие с документами → подписка → вопросы знакомства
 *
 * Согласие первым: без него у платформы нет основания ни обрабатывать
 * данные человека, ни оказывать услугу. Оно требуется даже от того,
 * чья подписка кончилась, — иначе человек попадёт на экран продления,
 * не имея возможности прочитать оферту, по которой платит.
 *
 * Вопросы знакомства последними: человеку без подписки они бессмысленны,
 * потому что подобранный разбор он всё равно не откроет.
 *
 * ⚠️ Проверка живёт здесь, а не в middleware. Middleware не ходит в базу
 * и границей безопасности не является (ADR-0003, CVE-2025-29927). Здесь
 * же — серверная разметка, у неё есть и сессия, и данные.
 * ─────────────────────────────────────────────────────────────────
 *
 * Недоступная база не должна запирать человека на знакомстве: сервис
 * согласий при сбое чтения возвращает пустой список, и проверка
 * пропускает дальше. Это та же политика, что у подписки, — молчание
 * инфраструктуры никогда не трактуется против участника.
 */
export async function requireOnboarding(): Promise<void> {
  if (!AUTH_ENABLED) return

  const session = await getSession()
  if (!session) return

  // Согласие проверяется отдельно от вопросов: человек, прошедший
  // знакомство год назад, обязан согласиться с новой редакцией оферты,
  // но заново рассказывать о себе не должен
  const missing = await missingLegalDocuments(session.user.id)
  if (missing.length > 0) {
    redirect(routes.app.onboarding())
  }

  const state = await findOnboardingState(session.user.id)
  if (state && !isOnboardingDone(state.onboardingDoneAt)) {
    redirect(routes.app.onboarding())
  }
}
