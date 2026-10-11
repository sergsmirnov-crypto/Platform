/**
 * Настройки, доступные в браузере.
 *
 * Сюда попадает только то, что не является секретом: эти значения
 * встраиваются в код страницы и видны любому, кто откроет исходники.
 *
 * Обращение к `process.env.NEXT_PUBLIC_*` записано полными именами намеренно:
 * подстановку значений при сборке Next.js выполняет по текстовому совпадению,
 * поэтому обращение через переменную (`process.env[name]`) работать не будет.
 */
export const clientEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '',
  posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? '',
} as const
