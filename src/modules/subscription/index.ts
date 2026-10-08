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
} from './entitlement-policy'

export { getSubscriptionHistory, getSubscriptionOverview, grantAccess, revokeAccess } from './admin'
export type { SubscriptionListItem, SubscriptionOverview, SubscriptionSummary } from './admin'
export type { SubscriptionFilter } from './admin-repository'

export { findReconcileCandidates, reconcileAccess, verifyMembershipNow } from './reconcile'
export type { ReconcileReport, ReconcileTarget } from './reconcile'

export { interpretUpdate, isWebhookSecretValid } from './webhook'
export type { WebhookVerdict } from './webhook'

export {
  claimTelegramUpdate,
  deleteOldTelegramUpdates,
  findSubscriptionHistory,
  markTelegramUpdate,
} from './repository'
export { subscriptionStrings } from './strings'
