/**
 * Публичный вход в настройки приложения.
 *
 * Внимание: `env.server` намеренно НЕ реэкспортируется отсюда.
 * Серверные настройки импортируются явно:
 *
 *     import { serverEnv } from '@/shared/config/env.server'
 *
 * Так по одной строке импорта видно, что файл выполняется только на сервере,
 * и случайно затащить секреты в браузерный код не получится.
 */
export { appConfig } from './app.config'
export type { AppConfig } from './app.config'
export { clientEnv } from './env.client'
export { AUTH_ENABLED } from './features'
export { SESSION_COOKIE_NAME, RETURN_TO_PARAM } from './constants'
