/**
 * Публичный вход в модуль подписок.
 *
 * Отвечает на один вопрос: положен ли этому человеку доступ к платному
 * содержимому. Кто он такой — знает модуль `identity`, что ему разрешено
 * делать — модуль `access`.
 */
export {
  applySubscriptionEvent,
  expireOutdatedEntitlements,
  getAccessStatus,
  getExpiringSoon,
  getNotifiableUserIds,
  grantAccessManually,
  hasActiveAccess,
  recordChannelMembership,
  recordToolsySubscription,
  revokeAccessManually,
  syncAccessFromKnownMembership,
} from './service'
export type { AccessStatus } from './service'

export { daysUntilLoss, grantsAccess } from './entitlement-policy'
export type {
  EntitlementEvent,
  EntitlementSource,
  EntitlementState,
  EntitlementStatus,
  PaidSource,
} from './entitlement-policy'

export { getSubscriptionHistory, getSubscriptionOverview, grantAccess, revokeAccess } from './admin'
export type { SubscriptionListItem, SubscriptionOverview, SubscriptionSummary } from './admin'
export type { SubscriptionFilter } from './admin-repository'

export {
  findReconcileCandidates,
  reconcileAccess,
  syncToolsySubscriptions,
  verifyMembershipNow,
} from './reconcile'
export type { ReconcileReport, ReconcileTarget, ToolsySyncReport } from './reconcile'

export { interpretToolsyEvent } from './toolsy'
export type { ToolsyVerdict } from './toolsy'

export { interpretUpdate, isWebhookSecretValid } from './webhook'
export type { WebhookVerdict } from './webhook'

export {
  claimTelegramUpdate,
  deleteOldTelegramUpdates,
  findSubscriptionHistory,
  markTelegramUpdate,
} from './repository'
export { subscriptionStrings } from './strings'
