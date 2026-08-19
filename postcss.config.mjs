/**
 * Tailwind CSS v4 подключается как плагин PostCSS.
 * Настройка темы (цвета, шрифты, отступы) живёт не здесь,
 * а в src/app/globals.css — это способ настройки Tailwind v4.
 * Наполним её на шаге F5 (дизайн-система).
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
