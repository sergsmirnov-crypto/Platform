import 'server-only'

import { appConfig } from '@/shared/config/app.config'
import { clientEnv } from '@/shared/config/env.client'
import { getLogger } from '@/shared/logger'

import { isSatisfied, missingAcceptances } from './acceptance'
import { acceptableDocuments, LEGAL_DOCUMENTS } from './documents'
import { unfilledPlaceholders } from './placeholders'
import { insertAcceptances, listAcceptances } from './repository'

import type { PlaceholderValues } from './placeholders'
import type { AcceptableDocumentId, AcceptedVersion, LegalDocumentId } from './types'

/**
 * Работа с правовыми документами и согласиями.
 */

/**
 * Реквизиты для подстановки в текст.
 *
 * Собираются здесь, а не в `placeholders.ts`: тот файл чистый и ничего
 * не знает ни о настройках, ни об окружении, поэтому целиком проверяется
 * тестом. Адрес платформы берётся из окружения, а не из настроек: он
 * различается между разработкой и боевым сервером, и в документе должен
 * стоять тот, по которому человек эту страницу открыл.
 */
export function legalValues(): PlaceholderValues {
  const operator = appConfig.operator

  return {
    OPERATOR_NAME: operator.name,
    OPERATOR_FORM: operator.form,
    OPERATOR_INN: operator.inn,
    OPERATOR_REGISTRY: operator.registryNumber,
    OPERATOR_ADDRESS: operator.address,
    OPERATOR_EMAIL: operator.email,
    PLATFORM_DOMAIN: platformDomain(),
    PAYMENT_SERVICE: operator.paymentService,
    PAYMENT_LOCATION: operator.paymentLocation,
    SUBSCRIPTION_PRICE: operator.subscriptionPrice,
    SUBSCRIPTION_PERIOD: operator.subscriptionPeriod,
    GRACE_DAYS: String(appConfig.subscription.graceDays),
    MAX_DEVICES: String(appConfig.session.maxActiveDevices),
    NOTICE_DAYS: String(operator.noticeDays),
    VIDEO_PROVIDER: operator.videoProvider,
    VIDEO_LOCATION: operator.videoLocation,
    STORAGE_PROVIDER: operator.storageProvider,
    STORAGE_LOCATION: operator.storageLocation,
    HOSTING_PROVIDER: operator.hostingProvider,
    HOSTING_LOCATION: operator.hostingLocation,
  }
}

/**
 * Адрес платформы без схемы: в тексте документа `https://` только мешает
 * читать, а ссылки рядом всё равно рабочие.
 */
function platformDomain(): string {
  try {
    return new URL(clientEnv.appUrl).host
  } catch {
    return clientEnv.appUrl
  }
}

/** Незаполненные реквизиты — для предупреждения на странице */
export function unfilledLegalValues() {
  return unfilledPlaceholders(legalValues())
}

/**
 * С какими документами человеку осталось согласиться.
 *
 * Вызывается онбордингом при каждом входе, поэтому недоступная база здесь
 * не должна превращаться в блокировку: если прочитать согласия не удалось,
 * считаем, что всё в порядке, и пропускаем человека дальше. Это та же
 * политика, что у подписки (ADR: fail-open) — молчание инфраструктуры
 * никогда не трактуется против участника.
 */
export async function missingLegalDocuments(userId: string): Promise<AcceptableDocumentId[]> {
  try {
    const accepted = await listAcceptances(userId)
    return missingAcceptances(acceptableDocuments(), accepted)
  } catch (error) {
    getLogger().error({ err: error, userId }, 'не удалось прочитать согласия с документами')
    return []
  }
}

/**
 * Записывает согласие со всеми действующими редакциями.
 *
 * Согласие даётся сразу со всеми документами, требующими его: разделять
 * оферту и политику двумя нажатиями бессмысленно — доступ к платформе
 * невозможен без обоих, и «согласен только с одним» не является
 * работающим состоянием.
 */
export async function acceptCurrentDocuments(
  userId: string,
  context: { ipHash?: string | null; userAgent?: string | null } = {},
): Promise<void> {
  const documents = acceptableDocuments()

  await insertAcceptances(
    userId,
    documents.map((document) => ({
      document: document.id as AcceptableDocumentId,
      version: document.version,
    })),
    context,
  )

  getLogger().info(
    { userId, documents: documents.map((document) => `${document.id}@${document.version}`) },
    'согласие с правовыми документами записано',
  )
}

/**
 * Что человек подписал — для карточки участника в разделе «Управление».
 */
export async function acceptanceSummary(userId: string): Promise<
  {
    id: LegalDocumentId
    title: string
    version: number
    acceptedAt: Date | null
  }[]
> {
  const accepted = await listAcceptances(userId)

  return acceptableDocuments().map((document) => ({
    id: document.id,
    title: document.title,
    version: document.version,
    acceptedAt: currentAcceptanceDate(document.id, document.version, accepted),
  }))
}

function currentAcceptanceDate(
  id: LegalDocumentId,
  version: number,
  accepted: AcceptedVersion[],
): Date | null {
  const document = LEGAL_DOCUMENTS[id]
  if (!isSatisfied(document, accepted)) return null

  const matching = accepted
    .filter((record) => record.document === id && record.version >= version)
    .sort((left, right) => left.acceptedAt.getTime() - right.acceptedAt.getTime())

  return matching[0]?.acceptedAt ?? null
}
