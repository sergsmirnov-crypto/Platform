import 'server-only'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { serverEnv } from '@/shared/config/env.server'

import * as schema from './schema'

/**
 * Подключение к базе данных.
 *
 * Соединения переиспользуются: открывать новое на каждый запрос дорого.
 * В режиме разработки Next.js перезагружает код при каждой правке файла,
 * поэтому подключение сохраняется в глобальной области — иначе за час работы
 * накопились бы сотни открытых соединений и база перестала бы отвечать.
 */

declare global {
  var __dbClient: ReturnType<typeof postgres> | undefined
}

function createClient() {
  if (!serverEnv.DATABASE_URL) {
    throw new Error(
      'Не задано подключение к базе данных (DATABASE_URL). ' +
        'Проверьте файл .env, образец — .env.example. ' +
        'База поднимается командой: docker compose up -d',
    )
  }

  return postgres(serverEnv.DATABASE_URL, {
    /**
     * Размер пула соединений.
     *
     * При 250 участниках десяти достаточно с большим запасом: соединение
     * занято только на время запроса, а запросы занимают миллисекунды.
     * Ставить больше вредно — каждое соединение расходует память базы.
     */
    max: serverEnv.NODE_ENV === 'production' ? 10 : 5,
    /** Соединение, не использованное 20 секунд, закрывается */
    idle_timeout: 20,
    /** Если база не отвечает 10 секунд — ошибка, а не бесконечное ожидание */
    connect_timeout: 10,
    /** Служебные уведомления PostgreSQL в журнал приложения не пишем */
    onnotice: () => {},
  })
}

const client = globalThis.__dbClient ?? createClient()

if (serverEnv.NODE_ENV !== 'production') {
  globalThis.__dbClient = client
}

/**
 * Точка доступа к базе.
 *
 * Использовать её напрямую можно только в файлах `repository.ts` внутри
 * модулей. Компоненты и обработчики запросов обращаются к данным
 * через сервисы модуля — так запросы не расползаются по всему проекту.
 */
export const db = drizzle(client, { schema })

export type Database = typeof db

/** Проверка доступности базы. Используется адресом /api/health. */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await client`SELECT 1`
    return true
  } catch {
    return false
  }
}
