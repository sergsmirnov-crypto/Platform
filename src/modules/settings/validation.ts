import { z } from 'zod'

/**
 * Проверка настроек, которые правит человек без разработчика.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ ПРОВЕРЯТЬ ТО, ЧТО ВВОДИТ ВЛАДЕЛЕЦ ПЛАТФОРМЫ
 *
 * Не от злого умысла, а от опечатки. Настройки попадают в базу как
 * произвольный JSON и оттуда — прямо на страницы, которые видят все.
 * Ссылка без протокола («t.me/club» вместо «https://t.me/club») ведёт
 * в никуда; пустой заголовок карточки рисует пустой прямоугольник;
 * текст на десять тысяч знаков ломает вёрстку страницы «О клубе».
 *
 * Проверка отделена от записи и покрыта тестами: ошибка здесь означает
 * сломанную страницу у всех участников сразу.
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * Ссылка в Telegram.
 *
 * Помимо обычного `https` разрешён `tg://` — так открываются прямые
 * ссылки на бота и чаты в установленном приложении, минуя браузер.
 * Всё остальное отвергается: настройка попадает в атрибут `href`,
 * и `javascript:` там не место.
 */
const telegramUrl = z
  .string()
  .trim()
  .refine(
    (value) => value.startsWith('https://') || value.startsWith('tg://'),
    'Ссылка должна начинаться с https:// или tg://',
  )
  .refine((value) => value.length <= 500, 'Слишком длинная ссылка')

/** Пустая ссылка означает «не задана» и допустима */
export const renewUrlSchema = z.union([z.literal(''), telegramUrl])

export const MAX_CHAT_CARDS = 6

export const telegramChatSchema = z.object({
  title: z.string().trim().min(1, 'Без названия карточка пустая').max(60, 'Слишком длинно'),
  description: z.string().trim().max(120, 'Одна строка, не больше').default(''),
  url: telegramUrl,
})

/**
 * Карточек чатов не больше шести.
 *
 * Ограничение не техническое: блок переходов стоит на главной, и семь
 * карточек в нём означают, что человек не откроет ни одной. Три-четыре —
 * рабочее число (PRD v0.1 §7.6).
 */
export const telegramChatsSchema = z.array(telegramChatSchema).max(MAX_CHAT_CARDS)

const clubPointSchema = z.object({
  title: z.string().trim().min(1, 'Нужен заголовок').max(60, 'Слишком длинно'),
  text: z.string().trim().min(1, 'Нужно пояснение').max(300, 'Слишком длинно'),
})

const clubQuestionSchema = z.object({
  question: z.string().trim().min(1, 'Нужен вопрос').max(200, 'Слишком длинно'),
  answer: z.string().trim().min(1, 'Нужен ответ').max(800, 'Слишком длинно'),
})

/**
 * Страница «О клубе» — блоки заданной формы, а не свободный текст
 * с разметкой. Блоки сломать нельзя, можно только заполнить.
 */
export const clubAboutSchema = z.object({
  intro: z.string().trim().min(1, 'Вступление обязательно').max(600, 'Слишком длинно'),
  points: z.array(clubPointSchema).max(6),
  steps: z.array(clubPointSchema).max(6),
  schedule: z.string().trim().max(200, 'Одна строка, не больше').default(''),
  questions: z.array(clubQuestionSchema).max(12),
})

/** Схема проверки для каждой настройки, которую можно править из интерфейса */
export const SETTING_SCHEMAS = {
  'telegram.chats': telegramChatsSchema,
  'subscription.renew_url': renewUrlSchema,
  'club.about': clubAboutSchema,
} as const

export type EditableSettingKey = keyof typeof SETTING_SCHEMAS

export function isEditableSetting(key: string): key is EditableSettingKey {
  return key in SETTING_SCHEMAS
}
