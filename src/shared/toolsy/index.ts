/**
 * Работа с Toolsy — сервисом, через который участники оплачивают подписку.
 *
 * Слой инфраструктуры: умеет проверять подпись уведомлений и обращаться
 * к API, но ничего не знает ни об участниках платформы, ни о правилах
 * доступа. Решения принимает модуль `subscription` (ADR-0031).
 *
 * Клиент (`client.ts`) намеренно не реэкспортируется отсюда: он обращается
 * к сети и работает только на сервере. Импортируется явно:
 *
 *     import { toolsy } from '@/shared/toolsy/client'
 */
export { verifyToolsySignature } from './verify'
export type {
  ToolsyEvent,
  ToolsyEventType,
  ToolsyPage,
  ToolsySubscription,
  ToolsySubscriptionStatus,
} from './types'
