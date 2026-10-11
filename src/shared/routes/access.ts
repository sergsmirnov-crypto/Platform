import { routes } from './routes'

/**
 * Какие адреса относятся к закрытой зоне.
 *
 * ⚠️ Важно: это НЕ проверка прав доступа, а только подсказка для перенаправления
 * («нет cookie — покажем страницу входа»). Настоящая проверка происходит
 * на сервере при обращении к данным. Причины — в ADR-0003.
 */

const PROTECTED_PREFIX = routes.app.dashboard()

export function isProtectedPath(pathname: string): boolean {
  return pathname === PROTECTED_PREFIX || pathname.startsWith(`${PROTECTED_PREFIX}/`)
}

/**
 * Какие разделы требуют действующей подписки.
 *
 * Участник без подписки (`member_expired` в PRD v0.1 §2.2) — это не гость.
 * Он сохраняет аккаунт, профиль, прогресс и избранное; ему открыты
 * страницы о клубе и каталог разборов без плеера. Закрыто только платное
 * содержимое.
 *
 * Это критично для возвращения: заглянув через полгода, человек видит
 * «ты остановился на уроке 7», а не пустоту и предложение зарегистрироваться.
 *
 * Список задан явно, а не «всё кроме»: при добавлении нового раздела
 * он по умолчанию окажется открытым, и это заметят сразу. Обратная
 * ошибка — случайно закрыть профиль или страницу продления — привела бы
 * к кольцу перенаправлений, из которого человек не выберется.
 */
const SUBSCRIPTION_REQUIRED_PREFIXES = [routes.app.learn.index(), routes.app.streams.index()]

export function requiresActiveSubscription(pathname: string): boolean {
  return SUBSCRIPTION_REQUIRED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}
