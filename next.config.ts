import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // standalone — компактная сборка для Docker: в образ попадает только то,
  // что реально нужно для запуска, без всего node_modules (шаг F10).
  output: 'standalone',

  // Строгий режим React подсвечивает небезопасные приёмы на этапе разработки.
  reactStrictMode: true,

  // Библиотека обработки изображений содержит машинный код под конкретную
  // операционную систему. Сборщик такое упаковать не может — пакет
  // подключается на сервере как есть (шаг 4.3).
  serverExternalPackages: ['sharp'],

  experimental: {
    serverActions: {
      // По умолчанию действие принимает не больше мегабайта. Фотография
      // приходит уже кадрированной и уменьшенной браузером — обычно
      // 150–300 килобайт, — но у подробного снимка бывает и больше.
      // Три мегабайта: с запасом и заметно меньше, чем предел на сам файл.
      bodySizeLimit: '3mb',
    },
  },

  // Заголовки безопасности. Применяются ко всем страницам.
  // Content-Security-Policy добавим на F6, когда станет известен список
  // внешних источников (видеохостинг, Sentry, PostHog).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
