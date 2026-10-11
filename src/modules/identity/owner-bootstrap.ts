import 'server-only'

import { grantRoleByCode, hasAnyRole, OWNER_ROLE_CODE } from '@/modules/access'
import { serverEnv } from '@/shared/config/env.server'
import { normalizeEmail } from '@/shared/email'
import { getLogger } from '@/shared/logger'

/**
 * Назначение владельца при первом входе.
 *
 * Разрывает замкнутый круг первого запуска: права выдаются в разделе
 * «Команда», а попасть туда может только тот, у кого права уже есть.
 *
 * Роль выдаётся только тому, чья почта указана в OWNER_EMAIL, и только
 * если у него ещё нет ни одной роли. Второе условие защищает от возврата
 * роли человеку, у которого её осознанно забрали: дальше права меняются
 * в интерфейсе, а не через файл настроек.
 *
 * Почта, а не Telegram ID, как было до ADR-0030: входят теперь по почте,
 * и владелец должен получить права в ту же минуту, а не после того, как
 * подключит Telegram.
 */
export async function grantOwnerRoleIfNeeded(userId: string, email: string): Promise<void> {
  const ownerEmail = serverEnv.OWNER_EMAIL

  if (!ownerEmail || normalizeEmail(ownerEmail) !== email) return
  if (await hasAnyRole(userId)) return

  await grantRoleByCode(userId, OWNER_ROLE_CODE, null)
  getLogger().info({ userId }, 'выдана роль владельца при первом входе')
}
