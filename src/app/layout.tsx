import '@fontsource-variable/onest/index.css'
import '@fontsource-variable/golos-text/index.css'

import { ThemeProvider } from '@/ui/theme/theme-provider'

import './globals.css'

import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Гитарный клуб',
    template: '%s · Гитарный клуб',
  },
  description: 'Закрытая платформа гитарного клуба: разборы, курс, эфиры.',
  // Закрытая платформа не должна попадать в поисковую выдачу
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  // Плеер и табы рассчитаны на мобильный «пюпитр»: масштабирование
  // не запрещаем, но стартовая ширина всегда равна ширине экрана
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0f12' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning нужен из-за класса темы: его выставляет
    // скрипт в браузере до отрисовки, и разметка сервера отличается
    <html lang="ru" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
