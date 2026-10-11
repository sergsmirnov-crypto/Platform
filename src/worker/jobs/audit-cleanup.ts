import { purgeOldAuditEntries } from '@/modules/audit'
import { appConfig } from '@/shared/config'
import { getLogger } from '@/shared/logger'

/**
 * Уборка журнала действий.
 *
 * Год хранения задан продуктом (PRD v0.3 §6) и лежит в `app.config.ts`.
 * Смысл срока в том, что вопрос «а как мы делали это в прошлом году»
 * ещё находится, а более старое не пригождается никогда — и хранить
 * персональные данные дольше, чем они нужны, не стоит.
 *
 * Задача намеренно тупая: одно удаление по дате, ничего не считает
 * и ни от чего не зависит. Сбой уборки безобиден — записи просто
 * поживут лишние сутки до следующего запуска.
 */
export async function runAuditCleanup(): Promise<void> {
  const removed = await purgeOldAuditEntries()

  getLogger().info(
    { job: 'audit.cleanup', removed, retentionDays: appConfig.manage.logRetentionDays },
    'уборка журнала действий выполнена',
  )
}
