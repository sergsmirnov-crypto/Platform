/**
 * Единый стиль форматирования кода.
 * Все спорные вопросы («точка с запятой или нет») решены здесь один раз,
 * чтобы они больше никогда не обсуждались и не мелькали в code review.
 *
 * @type {import('prettier').Config}
 */
const config = {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  arrowParens: 'always',
  endOfLine: 'lf',
  // Сортирует классы Tailwind в каноническом порядке — иначе они превращаются в кашу.
  plugins: ['prettier-plugin-tailwindcss'],
}

export default config
