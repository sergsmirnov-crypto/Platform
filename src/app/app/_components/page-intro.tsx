'use client'

import { usePathname } from 'next/navigation'

import { Breadcrumbs, PageHeader } from '@/ui'

import { buildBreadcrumbs } from '../_lib/breadcrumbs'

/**
 * Верх страницы закрытой зоны: путь, заголовок, описание, действия.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПРАВИЛО: каждая страница закрытой зоны начинается с `PageIntro`.
 * Собственные заголовки на страницах не пишутся.
 * ─────────────────────────────────────────────────────────────────
 *
 * Смысл правила — не в единообразии ради единообразия. Тридцать страниц
 * с самодельными заголовками — это тридцать разных отступов, размеров
 * и мест для кнопки «Создать». Привести их к общему виду потом стоит
 * дороже, чем задать правило один раз сейчас.
 *
 * Клиентский компонент нужен ради одной вещи: адреса текущей страницы.
 * Серверные компоненты его не знают, а именно из адреса строится путь.
 * Кнопки в `actions` при этом остаются серверными — они приходят готовой
 * разметкой и в браузере не выполняются.
 */

type PageIntroProps = {
  /** Заголовок страницы. Он же последнее звено пути */
  title: string
  description?: string | undefined
  /** Кнопки справа от заголовка: «Создать разбор», «Редактировать» */
  actions?: React.ReactNode | undefined
  /**
   * Названия сущностей в середине пути, по адресу звена.
   * Нужно там, где промежуточное звено — не раздел, а запись:
   * на странице урока это название модуля курса
   */
  crumbTitles?: Record<string, string> | undefined
}

export function PageIntro({ title, description, actions, crumbTitles }: PageIntroProps) {
  const pathname = usePathname()
  const crumbs = buildBreadcrumbs(pathname, title, crumbTitles)

  return (
    <div className="mb-8">
      <Breadcrumbs items={crumbs} />
      <PageHeader title={title} description={description} actions={actions} className="mb-0" />
    </div>
  )
}
