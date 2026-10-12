import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Проверка подписи уведомлений Toolsy.
 *
 * Адрес, на который Toolsy присылает уведомления об оплатах, открыт для
 * запросов из интернета. Подпись — единственное, что отличает Toolsy
 * от того, кто решил подарить себе подписку поддельным уведомлением.
 *
 * Алгоритм из документации Toolsy: заголовок `toolsy-signature` вида
 * `t=<время>,v1=<подпись>`, где подпись — HMAC-SHA256 от строки
 * `<время>.<тело запроса как есть>` на секретном ключе уведомлений.
 *
 * Тело нужно ровно в том виде, в каком оно пришло: после разбора JSON
 * и обратной сборки строка будет другой, и подпись не совпадёт.
 *
 * Время подписи намеренно не ограничивается. Повтор старого настоящего
 * уведомления ничего не испортит: сведения о подписке применяются, только
 * если они новее уже сохранённых (см. `saveToolsySubscription`). А строгий
 * срок отверг бы законную повторную доставку, если Toolsy подписывает
 * её заново не каждый раз.
 *
 * Чистая функция без настроек и журнала: секрет передаётся аргументом.
 */

const SIGNATURE_PATTERN = /^t=(\d+),v1=([a-f0-9]{64})$/

function computeHmac(timestamp: string, rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex')
}

/** Заголовок подписи так, как его собирает Toolsy. Для тестов */
export function signToolsyPayloadForTesting(
  timestamp: number,
  rawBody: string,
  secret: string,
): string {
  return `t=${timestamp},v1=${computeHmac(String(timestamp), rawBody, secret)}`
}

/**
 * Подлинно ли уведомление.
 *
 * @param header  значение заголовка `toolsy-signature`
 * @param rawBody тело запроса до разбора JSON
 * @param secret  секретный ключ уведомлений из кабинета Toolsy
 */
export function verifyToolsySignature(
  header: string | null | undefined,
  rawBody: string,
  secret: string | null | undefined,
): boolean {
  if (!secret || !header) return false

  const match = SIGNATURE_PATTERN.exec(header.trim())
  if (!match) return false

  const [, timestamp, received] = match
  const expected = computeHmac(timestamp!, rawBody, secret)

  // Сравнение за постоянное время: обычное === заканчивается на первом
  // несовпадении, и по времени ответа подпись подбирается по символу
  return timingSafeEqual(Buffer.from(received!, 'hex'), Buffer.from(expected, 'hex'))
}
