/**
 * Подстановка реквизитов в текст правовых документов.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ ВООБЩЕ МЕСТА ДЛЯ ПОДСТАНОВКИ
 *
 * Можно было вписать ИНН и почту прямо в текст. Тогда при смене формы
 * регистрации или адреса почты их пришлось бы искать по трём документам
 * вручную — и один экземпляр остался бы старым. Такое расхождение внутри
 * договора хуже, чем отсутствие пункта.
 *
 * Плюс главное: пока реквизитов нет, документы всё равно можно писать,
 * показывать и тестировать. Значения подставятся одной правкой настроек
 * перед запуском.
 * ─────────────────────────────────────────────────────────────────
 *
 * Функции здесь чистые: ни настроек, ни базы, ни окружения. Значения
 * приходят готовым набором — это делает их проверяемыми тестом и позволяет
 * тому же коду работать в фоновых задачах.
 */

/**
 * Что подставляется в текст.
 *
 * Ключи латиницей: они встречаются внутри русского текста как `{{EMAIL}}`,
 * и латиница сразу отличает служебное место от слова документа.
 */
export const PLACEHOLDER_KEYS = [
  'OPERATOR_NAME',
  'OPERATOR_FORM',
  'OPERATOR_INN',
  'OPERATOR_REGISTRY',
  'OPERATOR_ADDRESS',
  'OPERATOR_EMAIL',
  'PLATFORM_DOMAIN',
  'PAYMENT_SERVICE',
  'PAYMENT_LOCATION',
  'SUBSCRIPTION_PRICE',
  'SUBSCRIPTION_PERIOD',
  'GRACE_PERIOD',
  'MAX_DEVICES',
  'NOTICE_DAYS',
  'VIDEO_PROVIDER',
  'VIDEO_LOCATION',
  'STORAGE_PROVIDER',
  'STORAGE_LOCATION',
  'HOSTING_PROVIDER',
  'HOSTING_LOCATION',
  'EMAIL_PROVIDER',
  'EMAIL_LOCATION',
] as const

export type PlaceholderKey = (typeof PLACEHOLDER_KEYS)[number]

export type PlaceholderValues = Record<PlaceholderKey, string>

/**
 * Что показывается вместо незаполненного реквизита.
 *
 * Не пустая строка: «ИНН » выглядит как ошибка вёрстки, а «ИНН не указан» —
 * как честное признание, что документ ещё не готов. Второе лучше: человек
 * понимает, что видит, и может об этом сообщить.
 */
export const UNFILLED_MARK = '(не указано)'

/** Ищет места подстановки: `{{КЛЮЧ}}` */
const PLACEHOLDER_PATTERN = /\{\{([A-Z_]+)\}\}/g

/**
 * Какие места встречаются в тексте.
 *
 * Нужна тесту: он сверяет, что каждое место в документах имеет значение,
 * а значит опечатка вида `{{EMIAL}}` не доедет до боевого сервера.
 */
export function findPlaceholders(text: string): string[] {
  const found = new Set<string>()

  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    // Группа в выражении обязательная, поэтому она всегда есть. Проверка
    // нужна строгому режиму типов, а не логике
    const key = match[1]
    if (key) found.add(key)
  }

  return [...found].sort()
}

/**
 * Подставляет значения в текст.
 *
 * Неизвестное место остаётся как есть — это заметно глазом при вычитке
 * и ловится тестом. Молча удалять его нельзя: из документа исчез бы кусок
 * предложения, и никто бы этого не заметил.
 */
export function fillPlaceholders(text: string, values: PlaceholderValues): string {
  return text.replace(PLACEHOLDER_PATTERN, (whole: string, key: string) => {
    if (!isPlaceholderKey(key)) return whole

    const value = values[key].trim()
    return value === '' ? UNFILLED_MARK : value
  })
}

/**
 * Какие реквизиты ещё не заполнены.
 *
 * По этому списку страница показывает предупреждение — но только тому,
 * кто может это исправить. Участнику знать о недоделке незачем: он на неё
 * всё равно не влияет, а доверия к платформе такое сообщение не добавляет.
 */
export function unfilledPlaceholders(values: PlaceholderValues): PlaceholderKey[] {
  return PLACEHOLDER_KEYS.filter((key) => values[key].trim() === '')
}

function isPlaceholderKey(key: string): key is PlaceholderKey {
  return (PLACEHOLDER_KEYS as readonly string[]).includes(key)
}
