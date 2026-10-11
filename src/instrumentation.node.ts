/**
 * Проверка настроек при запуске сервера.
 *
 * Вынесено в отдельный файл потому, что Next.js собирает `instrumentation.ts`
 * сразу для двух сред: основного сервера и облегчённой среды, где выполняется
 * middleware. Во второй нет функции завершения процесса, и сборщик выдавал
 * предупреждение, даже несмотря на проверку среды в коде.
 *
 * Этот файл подключается только из основного сервера.
 */
export async function checkStartupConfiguration(): Promise<void> {
  try {
    const { serverEnv } = await import('@/shared/config/env.server')

    // eslint-disable-next-line no-console -- полноценный логер появится на шаге F6
    console.info(
      `[запуск] режим: ${serverEnv.NODE_ENV}, адрес: ${serverEnv.NEXT_PUBLIC_APP_URL}, ` +
        `проверка входа: ${serverEnv.AUTH_ENABLED === 'true' ? 'включена' : 'выключена'}`,
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))

    /**
     * На боевом сервере процесс завершается.
     *
     * Так задумано: контейнер, который не смог запуститься, не принимает
     * трафик, система развёртывания видит неудачу и оставляет работать
     * предыдущую версию. Альтернатива — приложение, отвечающее ошибкой
     * на каждый запрос, — выглядит как «сайт сломался» и чинится дольше.
     */
    if (process.env.NODE_ENV === 'production') {
      process.exit(1)
    }

    // В разработке ошибку показывает сам Next.js, а сервер продолжает
    // работать: поправил .env — страница перезагрузилась.
    throw error
  }
}
