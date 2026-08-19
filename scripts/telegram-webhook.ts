import { loadEnvFile } from 'node:process'

/**
 * Разовая настройка уведомлений Telegram.
 *
 * ─────────────────────────────────────────────────────────────────
 * САМАЯ ЧАСТАЯ ПРИЧИНА «КОД ЕСТЬ, СОБЫТИЙ НЕТ»
 *
 * Telegram не присылает `chat_member` по умолчанию — только если этот
 * тип явно перечислен при регистрации адреса. Забыть об этом легко,
 * а обнаруживается ошибка не сразу: вебхук зарегистрирован, ответы 200,
 * в журнале тишина, и подписки просто не обновляются.
 *
 * Поэтому регистрация — скрипт, а не строка из инструкции: список типов
 * берётся из кода, а не набирается руками.
 * ─────────────────────────────────────────────────────────────────
 *
 *   pnpm telegram:webhook           зарегистрировать адрес
 *   pnpm telegram:webhook --check   посмотреть, что зарегистрировано
 *   pnpm telegram:webhook --delete  отключить уведомления
 *
 * Запускать заново после каждой смены адреса платформы — в том числе
 * при каждом перезапуске туннеля во время разработки.
 *
 * Ещё два условия, без которых уведомлений не будет, и их скрипт
 * проверить не может:
 *   • бот должен быть АДМИНИСТРАТОРОМ закрытого канала;
 *   • адрес платформы должен быть доступен из интернета по https.
 */

loadEnvFile('.env')

const API_BASE = 'https://api.telegram.org'

/** Тот же список, что в `src/shared/telegram/types.ts` */
const REQUIRED_UPDATE_TYPES = ['message', 'chat_member', 'my_chat_member']

const token = process.env.TELEGRAM_BOT_TOKEN
const secret = process.env.TELEGRAM_WEBHOOK_SECRET
const appUrl = process.env.NEXT_PUBLIC_APP_URL
const channelId = process.env.TELEGRAM_CHANNEL_ID

const isCheckOnly = process.argv.includes('--check')
const isDelete = process.argv.includes('--delete')

function fail(message: string): never {
  console.error(`\n${message}\n`)
  process.exit(1)
}

if (!token) fail('Не задан TELEGRAM_BOT_TOKEN. Получить у @BotFather.')

async function call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`${API_BASE}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  const body = (await response.json()) as
    { ok: true; result: T } | { ok: false; error_code: number; description: string }

  if (!body.ok) fail(`Telegram ${method}: ${body.error_code} ${body.description}`)

  return body.result
}

type WebhookInfo = {
  url: string
  pending_update_count: number
  allowed_updates?: string[]
  last_error_date?: number
  last_error_message?: string
}

async function showCurrent(): Promise<void> {
  const info = await call<WebhookInfo>('getWebhookInfo')

  console.log('\nСейчас зарегистрировано:')
  console.log(`  адрес:            ${info.url || '— не задан —'}`)
  console.log(`  типы уведомлений: ${info.allowed_updates?.join(', ') ?? '— по умолчанию —'}`)
  console.log(`  в очереди:        ${info.pending_update_count}`)

  if (info.last_error_message) {
    const at = info.last_error_date ? new Date(info.last_error_date * 1000).toISOString() : '—'
    console.log(`  последняя ошибка: ${info.last_error_message} (${at})`)
  }

  // Молчаливая поломка, ради которой скрипт и написан
  if (info.url && !info.allowed_updates?.includes('chat_member')) {
    console.log(
      '\n⚠️  chat_member не в списке типов — события о составе канала приходить НЕ БУДУТ.' +
        '\n   Запустите pnpm telegram:webhook без --check.',
    )
  }

  console.log('')
}

async function main(): Promise<void> {
  if (isCheckOnly) {
    await showCurrent()
    return
  }

  if (isDelete) {
    await call('deleteWebhook')
    console.log('\nУведомления отключены. Подписки перестанут обновляться сами.\n')
    return
  }

  if (!secret || secret.length < 16) {
    fail(
      'Не задан TELEGRAM_WEBHOOK_SECRET (нужно не меньше 16 символов).\n' +
        'Сгенерировать: openssl rand -hex 24',
    )
  }
  if (!appUrl) fail('Не задан NEXT_PUBLIC_APP_URL — адрес платформы.')
  if (!appUrl.startsWith('https://')) {
    fail(`Telegram шлёт уведомления только по https. Сейчас: ${appUrl}`)
  }

  const url = `${appUrl.replace(/\/$/, '')}/api/telegram/webhook`

  await call('setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: REQUIRED_UPDATE_TYPES,
    // Накопившееся за время простоя не нужно: актуальное состояние
    // восстановит ночная сверка
    drop_pending_updates: true,
  })

  console.log(`\nГотово. Уведомления идут на ${url}`)

  if (!channelId) {
    console.log(
      '\n⚠️  Не задан TELEGRAM_CHANNEL_ID — события будут приходить, но обрабатываться не станут.' +
        '\n   Узнать идентификатор канала: перешлите любое сообщение из него боту @userinfobot.',
    )
  }

  console.log('\nОсталось проверить руками: бот — администратор закрытого канала.\n')

  await showCurrent()
}

void main()
