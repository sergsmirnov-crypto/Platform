import type { Level } from '@/modules/songs'
import { routes } from '@/shared/routes'

/**
 * Адрес страницы песни с выбранным уровнем и вариантом.
 *
 * Собирается в одном месте по той же причине, по которой существует
 * реестр адресов: имена параметров (`level`, `v`) не должны встречаться
 * в разметке — иначе переименование одного из них превращается в поиск
 * по всем компонентам страницы.
 *
 * Уровень не подставляется, если он и так выбран по умолчанию? Нет,
 * подставляется всегда: адрес из переключателя человек копирует и шлёт
 * в чат, и получатель должен увидеть тот же разбор, а не подобранный
 * по своему профилю.
 */
export function songUrl(slug: string, options: { level?: Level; variantId?: string } = {}): string {
  const params = new URLSearchParams()

  if (options.level) params.set('level', options.level)
  // Конкретный вариант указывается, только когда их несколько:
  // идентификатор в адресе делает ссылку нечитаемой и ломается,
  // если куратор пересоздаст разбор
  if (options.variantId) params.set('v', options.variantId)

  const query = params.toString()

  return query ? `${routes.app.learn.song(slug)}?${query}` : routes.app.learn.song(slug)
}
