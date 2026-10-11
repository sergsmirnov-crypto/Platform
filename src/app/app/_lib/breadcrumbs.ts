import { routes } from '@/shared/routes'

/**
 * Хлебные крошки: путь от главной до текущей страницы.
 *
 * Обязательны на всех вложенных страницах (PRD v0.1 §3.2). Причина
 * практическая: каталог разборов уходит на четыре уровня вглубь, и без
 * пути наверх человек с телефона выбирается только кнопкой «назад»
 * в браузере — а на установленной как приложение платформе её нет вовсе.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЦЕПОЧКА СТРОИТСЯ ИЗ АДРЕСА, а не задаётся на каждой странице руками.
 * Заданные вручную крошки врут при первом же переносе страницы: адрес
 * поменялся, а путь остался старым, и заметить это по коду невозможно.
 * ─────────────────────────────────────────────────────────────────
 *
 * Здесь только чистые функции: ни адреса текущей страницы, ни базы,
 * ни React. Поэтому построение цепочки покрыто тестами целиком.
 */

/** Заглушка динамического участка адреса: `/app/learn/songs/[slug]` */
const ANY = '[]'

export type Crumb = {
  href: string
  label: string
}

type Section = {
  /** Образец адреса. Участки `[]` совпадают с чем угодно */
  path: string
  title: string
}

/**
 * Разделы, которые могут оказаться в середине пути.
 *
 * Здесь НЕ нужны все страницы платформы — только те, через которые
 * лежит дорога к другим. Название конечной страницы приходит от неё самой:
 * разбор знает имя песни, а реестр знать его не может.
 *
 * Названия обязаны совпадать с меню — это проверяется тестом. Иначе
 * в меню будет «Разборы», а в крошках «Библиотека», и человек решит,
 * что это разные разделы.
 */
const SECTIONS: Section[] = [
  { path: routes.app.dashboard(), title: 'Главная' },

  { path: routes.app.learn.index(), title: 'Обучение' },
  { path: routes.app.learn.songs(), title: 'Разборы' },
  { path: routes.app.learn.course(), title: 'Курс' },
  { path: routes.app.learn.courseModule(ANY), title: 'Модуль' },

  { path: routes.app.streams.index(), title: 'Эфиры' },

  { path: routes.app.club.index(), title: 'Клуб' },
  { path: routes.app.club.curators(), title: 'Кураторы' },
  { path: routes.app.club.news(), title: 'Новости' },

  { path: routes.app.me.index(), title: 'Личный кабинет' },

  { path: routes.app.manage.index(), title: 'Управление' },
  { path: routes.app.manage.songs(), title: 'Разборы' },
]

function toSegments(path: string): string[] {
  return path.split('/').filter(Boolean)
}

/** Совпадает ли образец адреса с реальными участками пути */
function matches(pattern: string[], actual: string[]): boolean {
  if (pattern.length !== actual.length) return false
  return pattern.every((segment, index) => segment === ANY || segment === actual[index])
}

function findSection(actualSegments: string[]): Section | undefined {
  return SECTIONS.find((section) => matches(toSegments(section.path), actualSegments))
}

/**
 * Собирает цепочку от главной до текущей страницы.
 *
 * @param pathname     адрес текущей страницы
 * @param currentTitle её заголовок — он же последнее звено цепочки.
 *                     Всегда приходит от страницы: только она знает,
 *                     что `nothing-else-matters` называется
 *                     «Nothing Else Matters»
 * @param titleOverrides названия конкретных сущностей в середине пути,
 *                     по адресу звена. Нужно на странице урока, где
 *                     промежуточное звено — название модуля курса,
 *                     а не слово «Модуль»
 *
 * На самой главной цепочки нет: вести с главной на главную незачем.
 */
export function buildBreadcrumbs(
  pathname: string,
  currentTitle: string,
  titleOverrides: Record<string, string> = {},
): Crumb[] {
  const segments = toSegments(pathname)

  if (pathname === routes.app.dashboard()) return []

  const crumbs: Crumb[] = []

  // Промежуточные звенья: каждый префикс адреса, который является разделом.
  // Незарегистрированные пропускаются — так `/app/subscription/expired`
  // не порождает звено «Подписка», которого не существует как страницы
  for (let length = 1; length < segments.length; length += 1) {
    const prefix = segments.slice(0, length)
    const section = findSection(prefix)
    if (!section) continue

    const href = `/${prefix.join('/')}`
    crumbs.push({ href, label: titleOverrides[href] ?? section.title })
  }

  crumbs.push({ href: pathname, label: currentTitle })

  return crumbs
}

/** Названия разделов — для проверки согласованности с меню */
export function getSectionTitle(path: string): string | undefined {
  return findSection(toSegments(path))?.title
}
