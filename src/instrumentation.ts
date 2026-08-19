/**
 * Точка входа, которую Next.js выполняет один раз при запуске сервера,
 * до обработки первого запроса.
 *
 * Здесь проверяются настройки: приложение с неверной конфигурацией
 * не должно заработать вовсе — вместо того чтобы запуститься и сломаться
 * позже, когда им уже пользуются люди.
 *
 * Позже сюда же подключится Sentry (шаг F6).
 */
export async function register(): Promise<void> {
  // Проверка нужна только в основном серверном процессе.
  // Middleware выполняется в отдельной среде и настроек не читает.
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return
  }

  const { checkStartupConfiguration } = await import('./instrumentation.node')
  await checkStartupConfiguration()
}
