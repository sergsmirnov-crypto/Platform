import { NextResponse } from 'next/server'

import { RETURN_TO_PARAM, SESSION_COOKIE_NAME } from '@/shared/config/constants'
import { AUTH_ENABLED } from '@/shared/config/features'
import { isProtectedPath, routes } from '@/shared/routes'

import type { NextRequest } from 'next/server'

/**
 * Перенаправление неавторизованных посетителей закрытой зоны на страницу входа.
 *
 * ⚠️ ЭТО НЕ ЗАЩИТА. Middleware только смотрит, есть ли cookie, — он не знает,
 * действительна ли сессия, не ходит в базу и может быть обойдён
 * (см. ADR-0003 и CVE-2025-29927). Его задача — удобство: не показывать
 * человеку пустой экран вместо формы входа.
 *
 * Настоящая проверка прав живёт в слое доступа к данным и выполняется
 * при каждом обращении к содержимому.
 */
export function middleware(request: NextRequest) {
  if (!AUTH_ENABLED) {
    return NextResponse.next()
  }

  const { pathname, search } = request.nextUrl

  if (!isProtectedPath(pathname)) {
    return NextResponse.next()
  }

  if (request.cookies.has(SESSION_COOKIE_NAME)) {
    return NextResponse.next()
  }

  // Запоминаем, куда человек шёл, чтобы вернуть его туда после входа.
  const loginUrl = new URL(routes.home(), request.url)
  loginUrl.searchParams.set(RETURN_TO_PARAM, `${pathname}${search}`)

  return NextResponse.redirect(loginUrl)
}

export const config = {
  /**
   * Middleware вызывается только для страниц закрытой зоны.
   * Статика, изображения и служебные адреса его не касаются —
   * это заметно экономит время отклика.
   */
  matcher: ['/app/:path*'],
}
