/**
 * Подготовка платформы к локальному осмотру — одной командой.
 *
 * Запуск:
 *   pnpm demo
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ ОТДЕЛЬНАЯ КОМАНДА
 *
 * Подготовка состоит из пяти шагов: файл настроек, секрет подписи,
 * таблицы, справочники, демонстрационное содержимое. Каждый шаг сам
 * по себе прост, но пропуск любого даёт ошибку, из текста которой
 * непонятно, какой именно шаг забыт. Человеку, который просто хочет
 * посмотреть платформу, разбираться в этом незачем.
 *
 * Команда безопасна для повторного запуска: существующий файл `.env`
 * не перезаписывается, миграции применяются только недостающие,
 * справочники не дублируются.
 * ─────────────────────────────────────────────────────────────────
 *
 * Что команда НЕ делает: не поднимает базу данных (это `docker compose
 * up -d`) и не запускает сайт (это `pnpm dev`). Оба шага оставлены
 * снаружи намеренно — они запускают процессы, которые нужно видеть
 * и уметь остановить.
 */
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { loadEnvFile } from 'node:process'

const ENV_FILE = '.env'
const ENV_EXAMPLE = '.env.example'

/** Условный Telegram ID владельца для осмотра: настоящий не нужен */
const DEMO_OWNER_ID = '100000001'

function step(text: string): void {
  console.log(`\n▸ ${text}`)
}

function prepareEnvFile(): void {
  if (existsSync(ENV_FILE)) {
    step('Файл настроек .env уже есть — оставляю как есть')
    return
  }

  if (!existsSync(ENV_EXAMPLE)) {
    console.error(`Не найден образец настроек ${ENV_EXAMPLE}. Проект распакован не полностью?`)
    process.exit(1)
  }

  step('Создаю файл настроек .env')

  let content = readFileSync(ENV_EXAMPLE, 'utf-8')

  // Секрет подписи сессий. Без него служебный вход падает с ошибкой,
  // а сгенерировать его руками — отдельный шаг, о котором легко забыть
  const secret = randomBytes(32).toString('base64')
  content = content.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${secret}`)

  // Владелец: чтобы у демонстрационных разборов был куратор,
  // а раздел «Управление» было под кем открыть
  content = content.replace(/^OWNER_TELEGRAM_ID=.*$/m, `OWNER_TELEGRAM_ID=${DEMO_OWNER_ID}`)

  writeFileSync(ENV_FILE, content, 'utf-8')
  console.log('  секрет подписи сессий: сгенерирован')
  console.log(`  владелец для осмотра: Telegram ID ${DEMO_OWNER_ID}`)
}

async function run(command: string, title: string): Promise<void> {
  step(title)

  const { spawn } = await import('node:child_process')

  await new Promise<void>((resolve, reject) => {
    const child = spawn('pnpm', ['run', command], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Шаг «${title}» не выполнен`)),
    )
    child.on('error', reject)
  })
}

prepareEnvFile()

try {
  loadEnvFile(ENV_FILE)
} catch {
  // Файл только что создан — если его не прочитать, упадут следующие шаги
}

try {
  await run('db:migrate', 'Создаю таблицы в базе данных')
  await run('db:seed', 'Заполняю справочники: права, роли, владелец')
  await run('db:demo', 'Добавляю демонстрационное содержимое')
} catch (error) {
  console.error('\n' + (error instanceof Error ? error.message : String(error)))
  console.error('\nСамая частая причина — не запущена база данных.')
  console.error('Проверьте, что выполнено:  docker compose up -d\n')
  process.exit(1)
}

console.log('\n─────────────────────────────────────────────')
console.log('Готово. Дальше:')
console.log('')
console.log('  pnpm dev')
console.log('')
console.log('Затем открыть  http://localhost:3000/dev/login')
console.log('и войти под «Владелец» — это вход без Telegram, только для осмотра.')
console.log('─────────────────────────────────────────────\n')

process.exit(0)
