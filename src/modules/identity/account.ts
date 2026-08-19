import 'server-only'

import { isLastOwner } from '@/modules/access'
import { AUDIT_ACTIONS, recordAudit } from '@/modules/audit'
import { errors } from '@/shared/errors'
import { getLogger } from '@/shared/logger'

import { removeAvatarFilesQuietly } from './avatar-storage'
import { anonymizeUser, deleteAuthIdentities, findAvatarId, revokeAllSessions } from './repository'
import { identityStrings } from './strings'

/**
 * Удаление собственного аккаунта.
 *
 * Порядок шагов выбран так, чтобы прерывание на любом из них не оставило
 * человека наполовину удалённым в опасную сторону. Сначала снимается
 * возможность войти, потом затираются сведения, и только в конце —
 * файлы, потеря которых уже ничего не меняет.
 *
 * Что происходит на самом деле:
 *
 *   способы входа   удаляются  → войти под этим аккаунтом невозможно
 *   сессии          закрываются → все устройства выброшены немедленно
 *   личные сведения затираются  → имя, город, о себе, вкусы, ссылки
 *   фотография      удаляется   → файлы из хранилища
 *   строка участника остаётся   → якорь для журнала и истории подписки
 *
 * Отдельная запись в журнале обязательна: удаление аккаунта — самое
 * необратимое действие на платформе, и вопрос «куда делся человек»
 * должен иметь ответ.
 */

/** Имя, которое остаётся вместо настоящего */
const DELETED_DISPLAY_NAME = 'Удалённый участник'

export async function deleteOwnAccount(
  userId: string,
  context: { ipHash?: string | null } = {},
): Promise<void> {
  /*
   * Владелец не может исчезнуть последним.
   *
   * Платформа без владельца — это платформа, где некому выдать права
   * обратно: чинится только руками в базе. Отказ здесь неприятен, но
   * ошибка на этом месте неисправима из интерфейса вовсе (PRD v0.3 §3.1).
   */
  if (await isLastOwner(userId)) {
    throw errors.conflict(identityStrings.settings.deleteAccount.lastOwner)
  }

  const avatarId = await findAvatarId(userId)

  await deleteAuthIdentities(userId)
  await revokeAllSessions(userId)
  await anonymizeUser(userId, DELETED_DISPLAY_NAME)

  if (avatarId) {
    await removeAvatarFilesQuietly(userId, avatarId)
  }

  await recordAudit({
    actorId: userId,
    action: AUDIT_ACTIONS.accountDelete,
    entityType: 'user',
    entityId: userId,
    ipHash: context.ipHash ?? null,
  })

  getLogger().info({ userId }, 'участник удалил свой аккаунт')
}
