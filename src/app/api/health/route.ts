import { NextResponse } from 'next/server'

import { checkDatabaseConnection } from '@/shared/db'

/**
 * Проверка живости приложения.
 *
 * По этому адресу стучится система развёртывания, чтобы понять,
 * запустился ли контейнер и можно ли переключать на него посетителей.
 *
 * Проверяется не только сам процесс, но и доступность базы: приложение,
 * которое отвечает, но не видит базу, для участников бесполезно.
 *
 * Ответ намеренно скупой: наружу не должно утекать ничего о версии,
 * окружении и внутреннем устройстве.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const databaseReady = await checkDatabaseConnection()

  if (!databaseReady) {
    return NextResponse.json({ status: 'error' }, { status: 503 })
  }

  return NextResponse.json({ status: 'ok' })
}
