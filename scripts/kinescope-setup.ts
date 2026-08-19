import { loadEnvFile } from 'node:process'

/**
 * Разовая настройка Kinescope.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ СКРИПТ, А НЕ ПАНЕЛЬ
 *
 * Адрес, по которому Kinescope спрашивает у нас разрешение
 * на воспроизведение, в панели не настраивается — только через их API.
 * Делать это curl-ом из инструкции значит однажды опечататься в адресе
 * и полдня искать, почему видео не играет.
 *
 * Скрипт запускается заново после каждой смены адреса платформы —
 * в том числе при каждом перезапуске туннеля во время разработки.
 * ─────────────────────────────────────────────────────────────────
 *
 *   pnpm kinescope:setup            прописать настройки
 *   pnpm kinescope:setup --check    посмотреть, что прописано сейчас
 */

loadEnvFile('.env')

const API_BASE = 'https://api.kinescope.io/v1'

const token = process.env.VIDEO_API_KEY
const projectId = process.env.VIDEO_LIBRARY_ID
const appUrl = process.env.NEXT_PUBLIC_APP_URL
const authUser = process.env.VIDEO_AUTH_USER
const authPassword = process.env.VIDEO_AUTH_PASSWORD

const isCheckOnly = process.argv.includes('--check')

function fail(message: string): never {
  console.error(`\n${message}\n`)
  process.exit(1)
}

if (!token) fail('Не задан VIDEO_API_KEY. Панель Kinescope → Настройки → API-токены.')
if (!projectId) fail('Не задан VIDEO_LIBRARY_ID — идентификатор проекта в Kinescope.')
if (!appUrl) fail('Не задан NEXT_PUBLIC_APP_URL — адрес платформы.')

/**
 * Настройки задаются на уровне проекта, а не всей рабочей зоны.
 *
 * В одной зоне со временем окажутся и другие проекты — например, публичные
 * ролики для витрины, к которым спрашивать разрешение не нужно вовсе.
 * Настройка на уровне зоны распространилась бы и на них.
 */
const endpoint = `${API_BASE}/drm/auth/${projectId}`

async function check(): Promise<void> {
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${token}` },
  })

  const body = await response.text()

  if (!response.ok) {
    fail(`Kinescope ответил ${response.status}:\n${body}`)
  }

  console.log('Текущие настройки проверки доступа:\n')
  console.log(body)
}

async function apply(): Promise<void> {
  const authorizeUrl = new URL('/api/video/authorize', appUrl).toString()

  if (authorizeUrl.startsWith('http://')) {
    console.log('⚠️  Адрес без https. Для боевого сервера это недопустимо.\n')
  }

  if (authorizeUrl.includes('localhost') || authorizeUrl.includes('127.0.0.1')) {
    fail(
      'Адрес платформы указывает на localhost.\n\n' +
        'Kinescope обращается к нам из интернета, и до вашей машины не достучится.\n' +
        'Поднимите туннель и укажите его адрес в NEXT_PUBLIC_APP_URL:\n\n' +
        '  cloudflared tunnel --url http://localhost:3000\n',
    )
  }

  if (!authUser || !authPassword) {
    console.log(
      '⚠️  VIDEO_AUTH_USER и VIDEO_AUTH_PASSWORD не заданы.\n' +
        '    Обработчик разрешений будет открыт всему интернету.\n' +
        '    Для разработки допустимо, для боевого сервера — нет.\n',
    )
  }

  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: authorizeUrl,
      ...(authUser ? { username: authUser } : {}),
      ...(authPassword ? { password: authPassword } : {}),
      // Нестрогий режим: при временной недоступности нашего сервера
      // Kinescope не будет считать это отказом в доступе
      strict: false,
    }),
  })

  if (!response.ok) {
    fail(`Kinescope ответил ${response.status}:\n${await response.text()}`)
  }

  console.log('Готово. Kinescope будет спрашивать разрешение здесь:')
  console.log(`  ${authorizeUrl}\n`)
  console.log('Проверить: pnpm kinescope:setup --check')
}

try {
  await (isCheckOnly ? check() : apply())
} catch (error) {
  fail(
    'Не удалось связаться с Kinescope.\n' +
      (error instanceof Error ? error.message : String(error)),
  )
}
