import { cleanupLoginArtifacts, cleanupSessions } from '@/modules/identity'
import { getLogger } from '@/shared/logger'

/**
 * Уборка мёртвых сессий, а заодно кодов входа и ключей подключения Telegram.
 *
 * Одна задача, а не три: все три — следы входа на платформу, и разбирать
 * «что у нас запускается ночью» проще, когда они в одном месте.
 *
 * Истёкшие и закрытые записи не нужны дольше месяца, а таблица без уборки
 * растёт вечно: каждый вход с каждого устройства оставляет строку.
 * За год у 250 участников это десятки тысяч записей, которые замедляют
 * ровно тот запрос, который выполняется на каждой открытой странице.
 *
 * Месяц хранения выбран не случайно: этого хватает, чтобы разобрать
 * жалобу «меня разлогинило» по журналу, и при этом таблица остаётся
 * маленькой.
 */
export async function runSessionCleanup(): Promise<void> {
  const removed = await cleanupSessions()
  const login = await cleanupLoginArtifacts()

  getLogger().info(
    { job: 'sessions.cleanup', removed, codes: login.codes, linkTokens: login.linkTokens },
    'уборка сессий и одноразовых кодов выполнена',
  )
}
