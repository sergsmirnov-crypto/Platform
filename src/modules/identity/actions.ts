'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'

import { errors } from '@/shared/errors'
import { getLogger } from '@/shared/logger'
import { routes } from '@/shared/routes'
import { enforceRateLimit } from '@/shared/security/rate-limit'
import { defineAction } from '@/shared/server'

import { deleteOwnAccount } from './account'
import { avatarUploadSchema } from './avatar'
import { removeAvatarFiles, removeAvatarFilesQuietly, storeAvatarImage } from './avatar-storage'
import { avatarUrlFor } from './avatar-url'
import { clearSessionCookie, getRequestOrigin, setSessionCookie } from './cookie'
import { getSession } from './current-user'
import { isDevAuthAvailable } from './dev-auth'
import { normalizeArtists, profileInputSchema } from './profile'
import {
  findAvatarId,
  findUserById,
  updateAvatarId,
  updateProfile,
  updateProfileVisibility,
} from './repository'
import { endAllSessions, endDevice, endSession, hashClientIp, startSession } from './service'
import { identityStrings } from './strings'

/**
 * Действия входа и выхода.
 *
 * Настоящий вход через Telegram появится на шаге 2.3. Здесь пока служебный
 * вход для разработки и общий выход — этого достаточно, чтобы проверить,
 * что сессии работают.
 */

/**
 * Вход под существующим участником без обращения к Telegram.
 *
 * Нужен по практической причине: виджет входа Telegram работает только
 * на домене, зарегистрированном у бота, и на `localhost` не запускается.
 * Без этой двери разработку всех следующих этапов пришлось бы вести
 * на живом сервере.
 *
 * Защита простая и надёжная: в производственной сборке `NODE_ENV`
 * равен `production`, и действие отказывает сразу, не заглядывая в базу.
 */
export const devSignIn = defineAction({
  name: 'identity.devSignIn',
  input: z.object({ userId: z.uuid() }),
  handler: async ({ userId }) => {
    if (!isDevAuthAvailable()) {
      getLogger().warn('попытка служебного входа вне режима разработки')
      throw errors.forbidden(identityStrings.devSignIn.unavailable)
    }

    const user = await findUserById(userId)
    if (!user) {
      throw errors.notFound(identityStrings.errors.userNotFound)
    }

    const origin = await getRequestOrigin()
    const { token, expiresAt } = await startSession(user.id, origin)
    await setSessionCookie(token, expiresAt)

    return { userId: user.id }
  },
})

/**
 * Выход.
 *
 * Сессия закрывается в базе, а не только удаляется cookie: иначе
 * скопированный ранее ключ продолжал бы работать.
 */
export const signOut = defineAction({
  name: 'identity.signOut',
  handler: async () => {
    const session = await getSession()

    if (session) {
      await endSession(session.sessionId)
    }

    await clearSessionCookie()

    return { ok: true }
  },
})

/**
 * Выход с перенаправлением на лендинг — для кнопки в интерфейсе.
 *
 * Отдельное действие, потому что `redirect` внутри `defineAction`
 * работать не может: он бросает специальное исключение, которое обёртка
 * приняла бы за ошибку.
 */
export async function signOutAndRedirect(): Promise<void> {
  const session = await getSession()

  if (session) {
    await endSession(session.sessionId)
  }

  await clearSessionCookie()

  redirect(routes.home())
}

/**
 * Ограничение частоты попыток входа.
 *
 * Вызывается перед проверкой данных, чтобы перебор упирался в лимит
 * до обращения к базе. Понадобится на шаге 2.3; здесь объявлено рядом
 * с остальными действиями входа, чтобы не разъезжалось по проекту.
 */
export async function enforceLoginRateLimit(): Promise<void> {
  const origin = await getRequestOrigin()

  enforceRateLimit({
    action: 'login',
    subject: origin.ip ?? 'unknown',
    limit: 10,
    windowSeconds: 300,
  })
}

/**
 * Сохранение профиля.
 *
 * Правит человек только собственный профиль: идентификатор берётся
 * из сессии, а не из формы. Передай его формой — и любой желающий
 * переписал бы чужую карточку, подставив другой номер.
 *
 * Правка чужих профилей — отдельная возможность с правом `users.edit`,
 * она появится в разделе управления на Этапе 9.
 */
export const saveProfile = defineAction({
  name: 'identity.saveProfile',
  input: profileInputSchema,
  handler: async (input) => {
    const session = await getSession()
    if (!session) throw errors.unauthorized()

    await updateProfile(session.user.id, {
      displayName: input.displayName,
      city: input.city,
      bio: input.bio,
      playingSince: input.playingSince,
      skillLevel: input.skillLevel,
      favoriteArtists: normalizeArtists(input.favoriteArtists),
      favoriteGenres: input.favoriteGenres,
      // Незаполненные ссылки не хранятся: пустая строка в базе — это мусор,
      // который потом придётся отличать от «не указано» в каждом запросе
      socials: Object.fromEntries(
        Object.entries(input.socials).filter(([, value]) => Boolean(value)),
      ) as Record<string, string>,
    })

    // Страница профиля собирается на сервере, поэтому после сохранения
    // её нужно пересобрать — иначе человек увидит старые данные
    revalidatePath(routes.app.me.profile())
    revalidatePath(routes.app.dashboard())

    return { saved: true }
  },
})

/**
 * Обновление страниц, на которых видна фотография.
 *
 * Шапка живёт в разметке закрытой зоны, поэтому одной страницы мало:
 * обновляются и личные разделы, и главная. Дешевле, чем кажется, —
 * страницы всё равно собираются на сервере при каждом запросе.
 */
function revalidateAvatarPages(): void {
  revalidatePath(routes.app.me.profile())
  revalidatePath(routes.app.me.index())
  revalidatePath(routes.app.dashboard())
}

/**
 * Загрузка фотографии профиля.
 *
 * Файл приходит уже кадрированным и уменьшенным браузером, но доверия
 * к нему нет: изображение пересобирается на сервере заново, и только
 * результат этой пересборки попадает в хранилище (`avatar-storage.ts`).
 *
 * Порядок шагов выбран так, чтобы ни одна поломка не оставила участника
 * без фотографии вообще: сначала файлы в хранилище, потом запись в базе,
 * и только в самом конце — уборка прежних файлов. Если уборка не удастся,
 * останется мусор на сорок килобайт; если бы порядок был обратным,
 * не удалась бы сама загрузка.
 */
export const uploadAvatar = defineAction({
  name: 'identity.uploadAvatar',
  input: avatarUploadSchema,
  handler: async ({ file }) => {
    const session = await getSession()
    if (!session) throw errors.unauthorized()

    // Обработка изображения стоит процессорного времени, а хранилище —
    // денег. Дюжина замен в час — заведомо больше, чем нужно человеку,
    // и заведомо меньше, чем нужно для вреда
    enforceRateLimit({
      action: 'avatar.upload',
      subject: session.user.id,
      limit: 12,
      windowSeconds: 3600,
    })

    const previousAvatarId = await findAvatarId(session.user.id)
    const avatarId = uuidv7()

    await storeAvatarImage(session.user.id, avatarId, Buffer.from(await file.arrayBuffer()))
    await updateAvatarId(session.user.id, avatarId)

    if (previousAvatarId) {
      await removeAvatarFilesQuietly(session.user.id, previousAvatarId)
    }

    revalidateAvatarPages()

    return { avatarUrl: avatarUrlFor(session.user.id, avatarId, 'lg') }
  },
})

/**
 * Удаление фотографии.
 *
 * Здесь порядок обратный загрузке: сначала база, потом файлы. Запись
 * в базе — это то, что видит участник; если после неё не удастся убрать
 * файлы, фотография всё равно исчезнет из интерфейса.
 */
export const removeAvatar = defineAction({
  name: 'identity.removeAvatar',
  handler: async () => {
    const session = await getSession()
    if (!session) throw errors.unauthorized()

    const avatarId = await findAvatarId(session.user.id)
    if (!avatarId) return { removed: false }

    await updateAvatarId(session.user.id, null)
    await removeAvatarFiles(session.user.id, avatarId)

    revalidateAvatarPages()

    return { removed: true }
  },
})

/**
 * Закрыть одно устройство.
 *
 * Принадлежность проверяет сервис: чужую сессию нельзя закрыть, даже
 * зная её идентификатор.
 */
export const endDeviceAction = defineAction({
  name: 'identity.endDevice',
  input: z.object({ sessionId: z.uuid() }),
  handler: async ({ sessionId }) => {
    const session = await getSession()
    if (!session) throw errors.unauthorized()

    await endDevice(session.user.id, sessionId)
    revalidatePath(routes.app.me.settings())

    return { ended: true }
  },
})

/**
 * Выйти везде, кроме текущего устройства.
 *
 * Главный сценарий — «я входил с чужого компьютера». Поэтому текущая
 * сессия сохраняется: человек не должен выбрасывать сам себя, спасаясь
 * от чужого входа.
 */
export const endOtherDevicesAction = defineAction({
  name: 'identity.endOtherDevices',
  handler: async () => {
    const session = await getSession()
    if (!session) throw errors.unauthorized()

    await endAllSessions(session.user.id, session.sessionId)
    revalidatePath(routes.app.me.settings())

    return { ended: true }
  },
})

/**
 * Удалить свой аккаунт.
 *
 * Подтверждение словом, а не галочкой: удаление необратимо, и случайное
 * нажатие на кнопку рядом с «Выйти» обошлось бы человеку слишком дорого.
 * Слово сверяется и на сервере — проверка в браузере только избавляет
 * от лишнего обращения.
 *
 * Cookie сессии убирается здесь же: после удаления она указывает
 * на несуществующего человека, и оставлять её — значит показывать
 * страницу входа с ошибкой вместо спокойного возврата на лендинг.
 */
export const deleteAccountAction = defineAction({
  name: 'identity.deleteAccount',
  input: z.object({
    confirmation: z.literal(identityStrings.settings.deleteAccount.confirmWord, {
      message: identityStrings.settings.deleteAccount.confirmMismatch,
    }),
  }),
  handler: async () => {
    const session = await getSession()
    if (!session) throw errors.unauthorized()

    const origin = await getRequestOrigin()

    await deleteOwnAccount(session.user.id, { ipHash: hashClientIp(origin.ip) })
    await clearSessionCookie()

    return { deleted: true }
  },
})

/**
 * Показать или скрыть свою визитку.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОТДЕЛЬНОЕ ДЕЙСТВИЕ, А НЕ ПОЛЕ В ФОРМЕ ПРОФИЛЯ
 *
 * Это согласие человека, а не сведение о нём. Оно должно меняться
 * осознанно и только явным нажатием: спрятанный среди полей
 * переключатель, который срабатывает при сохранении формы, — способ
 * раскрыть визитку случайно.
 * ─────────────────────────────────────────────────────────────────
 *
 * Идентификатор берётся из сессии: свою видимость человек меняет сам,
 * и никто больше.
 */
export const setProfileVisibility = defineAction({
  name: 'identity.setProfileVisibility',
  input: z.object({ visibility: z.enum(['private', 'club']) }),
  handler: async ({ visibility }) => {
    const session = await getSession()
    if (!session) throw errors.unauthorized()

    await updateProfileVisibility(session.user.id, visibility)

    revalidatePath(routes.app.me.settings())
    revalidatePath(routes.app.club.members())
    revalidatePath(routes.app.club.member(session.user.id))

    return { visibility }
  },
})
