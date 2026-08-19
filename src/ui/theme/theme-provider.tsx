'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

/**
 * Переключение светлой и тёмной темы.
 *
 * Тема сохраняется между визитами и применяется до первой отрисовки,
 * поэтому при загрузке страницы нет вспышки светлого фона у того,
 * кто выбрал тёмную тему.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      // По умолчанию берём системную настройку, но человек может выбрать сам
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
