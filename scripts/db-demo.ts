/**
 * Демонстрационное содержимое для разработки.
 *
 * Запуск: pnpm db:demo
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ ЭТО НУЖНО
 *
 * Каталог, фильтры, страница песни и постраничная навигация проверяются
 * только на содержимом. На пустой базе они выглядят одинаково рабочими
 * и одинаково сломанными: пустой список — это и правильный ответ,
 * и симптом неверного запроса.
 *
 * Настоящие разборы приедут из Telegram отдельным переносом (PRD v0.2 §3).
 * Здесь — восемь песен, подобранных так, чтобы задеть все случаи:
 * несколько уровней у одной песни и один у другой, два разбора одного
 * уровня от разных кураторов, черновик, запланированная публикация,
 * песня без вариантов вовсе, кириллица и латиница в названиях,
 * разные строи.
 *
 * Видео и файлы не создаются: их место займут настоящие на шаге 5.4.
 * Части разбора при этом размечены таймкодами — так проверяется
 * подсчёт длительности.
 * ─────────────────────────────────────────────────────────────────
 *
 * Команду можно запускать повторно: демо-песни определяются по адресу
 * и пересоздаются целиком. Ничего, кроме них, скрипт не трогает.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { loadEnvFile } from 'node:process'

import { eq, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { v7 as uuidv7 } from 'uuid'

import { songSlug } from '../src/modules/songs/domain'
import { TAG_SEEDS } from '../src/modules/taxonomy/catalog'
import * as schema from '../src/shared/db/schema'
import { slugify } from '../src/shared/utils/slug'

try {
  loadEnvFile('.env')
} catch {
  // На боевом сервере переменные приходят из окружения
}

if (process.env.NODE_ENV === 'production') {
  console.error('Демонстрационное содержимое в производственной среде не создаётся.')
  process.exit(1)
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Не задано подключение к базе данных (DATABASE_URL).')
  process.exit(1)
}

const client = postgres(url, { max: 1, onnotice: () => {} })
const db = drizzle(client, { schema })

type DemoSection = { title: string; start: number; end: number }

/**
 * Материал разбора.
 *
 * Файлы создаются на диске по-настоящему, в папке `.storage`, — иначе
 * кнопку «Скачать» невозможно проверить: она либо ведёт в никуда,
 * либо выглядит рабочей, не будучи ею.
 */
type DemoMaterial = {
  kind: 'pdf' | 'guitar_pro' | 'audio' | 'interactive_tab'
  title: string
  /** Для интерактивных табов файла нет — есть чужая страница */
  externalUrl?: string
  /** Каким сделать состояние обработки. По умолчанию готов */
  processingStatus?: 'processing' | 'ready' | 'failed'
  /** Разрешено ли скачивание. По умолчанию да */
  isDownloadable?: boolean
}

type DemoArrangement = {
  level: 'beginner' | 'intermediate' | 'advanced'
  title?: string
  summary: string
  estimatedMinutes: number
  status?: 'draft' | 'published'
  sections: DemoSection[]
  materials?: DemoMaterial[]
}

type DemoSong = {
  title: string
  artist: string
  album?: string
  year?: number
  tuning?: string
  capo?: number
  tempoBpm?: number
  musicKey?: string
  description: string
  status?: 'draft' | 'scheduled' | 'published'
  publishedAt?: Date
  tags: string[]
  arrangements: DemoArrangement[]
  /** Материалы самой песни: минусовка нужна на любом уровне */
  materials?: DemoMaterial[]
}

/** Обычная структура: шесть частей подряд, с реальными таймкодами */
function standardSections(): DemoSection[] {
  return [
    { title: 'Вступление', start: 0, end: 134 },
    { title: 'Куплет', start: 134, end: 319 },
    { title: 'Припев', start: 319, end: 479 },
    { title: 'Проигрыш', start: 479, end: 594 },
    { title: 'Соло', start: 594, end: 974 },
    { title: 'Сборка целиком', start: 974, end: 1224 },
  ]
}

function simpleSections(): DemoSection[] {
  return [
    { title: 'Вступление', start: 0, end: 95 },
    { title: 'Основная часть', start: 95, end: 340 },
    { title: 'Сборка целиком', start: 340, end: 520 },
  ]
}

const DAY = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(Date.now() - days * DAY)
const daysAhead = (days: number) => new Date(Date.now() + days * DAY)

const DEMO_SONGS: DemoSong[] = [
  {
    title: 'Nothing Else Matters',
    artist: 'Metallica',
    album: 'Metallica',
    year: 1991,
    tuning: 'e_standard',
    tempoBpm: 72,
    musicKey: 'Em',
    description:
      'Песня, с которой начинают почти все. Разбираем перебор во вступлении, ' +
      'аккорды в куплете и подводим к соло.',
    publishedAt: daysAgo(2),
    tags: ['Метал', 'Перебор', 'Соло'],
    arrangements: [
      {
        level: 'beginner',
        title: 'Акустика, упрощённо',
        summary: 'Четыре аккорда и простой перебор. Первая песня, которую можно доиграть до конца.',
        estimatedMinutes: 40,
        sections: simpleSections(),
        materials: [
          { kind: 'pdf', title: 'Табы, упрощённая версия' },
          // Файл ещё обрабатывается: проверяет, что вместо ссылки
          // человек видит объяснение, а не ошибку хранилища
          { kind: 'pdf', title: 'Аккордовая сетка', processingStatus: 'processing' },
        ],
      },
      {
        level: 'intermediate',
        title: 'Акустика, как в оригинале',
        summary: 'Полный перебор вступления, переходы и проигрыш.',
        estimatedMinutes: 90,
        sections: standardSections(),
        materials: [
          { kind: 'pdf', title: 'Табы, полная версия' },
          { kind: 'guitar_pro', title: 'Guitar Pro' },
          {
            kind: 'interactive_tab',
            title: 'Интерактивные табы',
            externalUrl: 'https://www.soundslice.com/',
          },
        ],
      },
      {
        level: 'advanced',
        title: 'Электро, с соло',
        summary: 'Соло целиком, с разбором фразировки и подтяжек.',
        estimatedMinutes: 180,
        sections: standardSections(),
      },
    ],
  },
  {
    title: 'Пачка сигарет',
    artist: 'Кино',
    album: 'Звезда по имени Солнце',
    year: 1989,
    tuning: 'e_standard',
    capo: 2,
    tempoBpm: 118,
    musicKey: 'Am',
    description: 'Четыре аккорда, бой и узнаваемая мелодия. Классика двора и костра.',
    publishedAt: daysAgo(6),
    tags: ['Русский рок', 'Бой', 'У костра'],
    arrangements: [
      {
        level: 'beginner',
        summary: 'Простой бой и четыре аккорда с каподастром на втором ладу.',
        estimatedMinutes: 30,
        sections: simpleSections(),
      },
      {
        level: 'intermediate',
        title: 'С проигрышем на одной струне',
        summary: 'Добавляем мелодическую линию и глушение.',
        estimatedMinutes: 60,
        sections: standardSections(),
      },
    ],
  },
  {
    title: 'Перемен',
    artist: 'Кино',
    year: 1989,
    tuning: 'e_standard',
    tempoBpm: 128,
    musicKey: 'Am',
    description: 'Разбираем бой с акцентами и переходы между частями.',
    publishedAt: daysAgo(11),
    tags: ['Русский рок', 'Бой'],
    arrangements: [
      {
        level: 'beginner',
        summary: 'Аккорды и ровный бой.',
        estimatedMinutes: 35,
        sections: simpleSections(),
      },
    ],
  },
  {
    title: 'Blackbird',
    artist: 'The Beatles',
    album: 'The White Album',
    year: 1968,
    tuning: 'e_standard',
    tempoBpm: 96,
    musicKey: 'G',
    description:
      'Фингерстайл, с которого удобно начинать: мелодия и бас играются одновременно, ' +
      'но темп прощает ошибки.',
    publishedAt: daysAgo(20),
    tags: ['Классический рок', 'Фингерстайл'],
    arrangements: [
      {
        level: 'intermediate',
        title: 'Вариант Ивана',
        summary: 'Разбор по фразам, с отдельным вниманием к независимости пальцев.',
        estimatedMinutes: 120,
        sections: standardSections(),
      },
      {
        // Два разбора одного уровня от разных кураторов — то, ради чего
        // варианты вынесены в отдельную таблицу
        level: 'intermediate',
        title: 'Вариант Марии, с упрощённым басом',
        summary: 'Тот же уровень, но бас сведён к основным долям.',
        estimatedMinutes: 90,
        sections: simpleSections(),
      },
    ],
  },
  {
    title: 'Hotel California',
    artist: 'Eagles',
    album: 'Hotel California',
    year: 1976,
    tuning: 'e_standard',
    capo: 7,
    tempoBpm: 74,
    musicKey: 'Bm',
    description: 'Аккомпанемент, арпеджио и подход к двойному соло.',
    publishedAt: daysAgo(30),
    tags: ['Классический рок', 'Соло', 'Медиатор'],
    arrangements: [
      {
        level: 'advanced',
        summary: 'Полный разбор, включая гармонизованное соло.',
        estimatedMinutes: 240,
        sections: standardSections(),
      },
    ],
  },
  {
    title: 'Кукушка',
    artist: 'Кино',
    year: 1990,
    tuning: 'drop_d',
    tempoBpm: 104,
    musicKey: 'Dm',
    description: 'Разбираем в пониженном строе — так звучит ближе к оригиналу.',
    publishedAt: daysAgo(45),
    tags: ['Русский рок', 'Бой', 'Грустное'],
    // Материал самой песни: минусовка одинакова для всех уровней
    materials: [{ kind: 'audio', title: 'Минусовка' }],
    arrangements: [
      {
        level: 'beginner',
        summary: 'Строй Drop D, три аккорда, ровный бой.',
        estimatedMinutes: 45,
        sections: simpleSections(),
      },
      {
        level: 'advanced',
        title: 'С мелодической линией',
        summary: 'Добавляем сольные вставки между куплетами.',
        estimatedMinutes: 150,
        sections: standardSections(),
      },
    ],
  },
  {
    // Черновик: виден только куратору. Проверяет, что участник его не видит
    title: 'Stairway to Heaven',
    artist: 'Led Zeppelin',
    album: 'Led Zeppelin IV',
    year: 1971,
    tuning: 'e_standard',
    tempoBpm: 82,
    musicKey: 'Am',
    description: 'Разбор в работе: вступление готово, соло записывается.',
    status: 'draft',
    tags: ['Классический рок', 'Фингерстайл', 'Соло'],
    arrangements: [
      {
        level: 'advanced',
        summary: 'Вступление, аккомпанемент, соло.',
        estimatedMinutes: 300,
        status: 'draft',
        sections: standardSections(),
      },
    ],
  },
  {
    // Запланированная публикация: открывается сама, по времени
    title: 'Wish You Were Here',
    artist: 'Pink Floyd',
    year: 1975,
    tuning: 'e_standard',
    tempoBpm: 60,
    musicKey: 'G',
    description: 'Выйдет на следующей неделе: вступление, аккорды, соло на акустике.',
    status: 'scheduled',
    publishedAt: daysAhead(5),
    tags: ['Классический рок', 'Перебор', 'Спокойное'],
    arrangements: [
      {
        level: 'intermediate',
        summary: 'Вступление с характерным «радиоприёмником» и аккомпанемент.',
        estimatedMinutes: 80,
        sections: standardSections(),
      },
    ],
  },
  {
    // Песня без вариантов: проверяет, что каталог и страница не падают
    title: 'Всё идёт по плану',
    artist: 'Гражданская оборона',
    year: 1988,
    tuning: 'e_standard',
    tempoBpm: 148,
    musicKey: 'Em',
    description: 'Заявка из чата. Разбор ещё не записан.',
    publishedAt: daysAgo(1),
    tags: ['Панк', 'Русский рок'],
    arrangements: [],
  },
]

/**
 * Создание файлов материалов.
 *
 * ─────────────────────────────────────────────────────────────────
 * ФАЙЛЫ СОЗДАЮТСЯ НАСТОЯЩИЕ
 *
 * Записи в базе без файлов на диске проверяют только вёрстку: кнопка
 * «Скачать» выглядит рабочей, а при нажатии отдаёт ошибку хранилища.
 * Поэтому скрипт кладёт на диск маленькие, но подлинные файлы —
 * PDF открывается, остальные скачиваются.
 *
 * Пишем напрямую в папку `.storage`, как это делает локальное хранилище:
 * подключать сюда его самого значило бы затащить в обычный скрипт
 * серверный код Next.js.
 * ─────────────────────────────────────────────────────────────────
 */

const STORAGE_ROOT = resolve(process.cwd(), '.storage')

/**
 * Ролик для проверки плеера.
 *
 * Загружать видео в Kinescope из скрипта мы не будем: это долго, платно
 * и требует настоящего файла. Достаточно одного ролика, загруженного
 * руками в панели, — его идентификатор кладётся в DEMO_VIDEO_ID,
 * и разбор «Nothing Else Matters» получает видео с оглавлением по частям.
 */
const DEMO_VIDEO_ID = process.env.DEMO_VIDEO_ID?.trim() || null

async function createDemoVideoAsset(uploadedBy: string | null): Promise<string | null> {
  if (!DEMO_VIDEO_ID) return null

  const assetId = uuidv7()

  await db.insert(schema.mediaAssets).values({
    id: assetId,
    kind: 'video',
    provider: 'kinescope',
    externalId: DEMO_VIDEO_ID,
    title: 'Демонстрационный ролик',
    processingStatus: 'ready',
    // Видео не скачивается никогда — ради этого и выбирается видеохостинг
    isDownloadable: false,
    uploadedBy,
  })

  return assetId
}

const EXTENSIONS: Record<DemoMaterial['kind'], string> = {
  pdf: 'pdf',
  guitar_pro: 'gp5',
  audio: 'mp3',
  interactive_tab: 'url',
}

const MEDIA_KINDS: Record<
  DemoMaterial['kind'],
  'pdf' | 'guitar_pro' | 'audio' | 'interactive_tab'
> = {
  pdf: 'pdf',
  guitar_pro: 'guitar_pro',
  audio: 'audio',
  interactive_tab: 'interactive_tab',
}

/** Самый маленький PDF, который открывается просмотрщиком */
function minimalPdf(title: string): Buffer {
  const text = title.replace(/[()\\]/g, '')
  const body = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length 90 >> stream`,
    `BT /F1 18 Tf 60 760 Td (${text}) Tj ET`,
    'BT /F1 11 Tf 60 730 Td (Demo file. Guitar club platform.) Tj ET',
    'endstream endobj',
    'trailer << /Root 1 0 R /Size 6 >>',
    '%%EOF',
  ].join('\n')

  return Buffer.from(body, 'latin1')
}

function demoFileBody(material: DemoMaterial): Buffer {
  if (material.kind === 'pdf') return minimalPdf(material.title)

  // Остальные виды в демо-данных содержательными быть не обязаны:
  // проверяется выдача ссылки и имя сохраняемого файла, а не формат
  return Buffer.from(`Демонстрационный файл: ${material.title}\n`, 'utf8')
}

/**
 * Создаёт файл и запись о нём, возвращает идентификатор.
 *
 * Ключ хранилища собирается по тем же правилам, что и в приложении:
 * первым участком — вид доступа. Материалы всегда закрытые, поэтому
 * `private`: постоянного адреса у них не существует.
 */
async function createMaterialAsset(
  material: DemoMaterial,
  ownerId: string,
  index: number,
  uploadedBy: string | null,
): Promise<string> {
  const assetId = uuidv7()
  const kind = MEDIA_KINDS[material.kind]

  if (material.kind === 'interactive_tab') {
    await db.insert(schema.mediaAssets).values({
      id: assetId,
      kind,
      provider: 'soundslice',
      url: material.externalUrl ?? null,
      title: material.title,
      processingStatus: 'ready',
      isDownloadable: false,
      uploadedBy,
    })

    return assetId
  }

  const key = `private/tabs/${ownerId}/${index + 1}-${assetId.slice(0, 8)}.${EXTENSIONS[material.kind]}`
  const body = demoFileBody(material)

  const target = resolve(STORAGE_ROOT, key)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, body)

  await db.insert(schema.mediaAssets).values({
    id: assetId,
    kind,
    provider: 's3',
    // Ключ объекта живёт в поле идентификатора у поставщика: для своего
    // хранилища «идентификатор файла» — это и есть путь к нему
    externalId: key,
    title: material.title,
    sizeBytes: body.byteLength,
    processingStatus: material.processingStatus ?? 'ready',
    isDownloadable: material.isDownloadable ?? true,
    uploadedBy,
  })

  return assetId
}

/** Привязывает материалы к песне или к варианту разбора */
async function attachMaterials(
  materials: DemoMaterial[] | undefined,
  entityType: 'song' | 'arrangement' | 'stream',
  entityId: string,
  uploadedBy: string | null,
): Promise<number> {
  if (!materials || materials.length === 0) return 0

  for (const [index, material] of materials.entries()) {
    const assetId = await createMaterialAsset(material, entityId, index, uploadedBy)

    await db.insert(schema.attachments).values({
      id: uuidv7(),
      entityType,
      entityId,
      mediaAssetId: assetId,
      title: material.title,
      orderIndex: index,
    })
  }

  return materials.length
}

async function ensureTags(): Promise<Map<string, string>> {
  for (const tag of TAG_SEEDS) {
    await db
      .insert(schema.tags)
      .values({
        id: uuidv7(),
        slug: tag.slug,
        name: tag.name,
        kind: tag.kind,
        orderIndex: tag.orderIndex,
      })
      .onConflictDoUpdate({
        target: schema.tags.slug,
        set: { name: tag.name, kind: tag.kind, orderIndex: tag.orderIndex },
      })
  }

  const rows = await db.select({ id: schema.tags.id, name: schema.tags.name }).from(schema.tags)
  const byName = new Map<string, string>()

  // Имя может встретиться дважды («Фингерстайл» — и жанр, и техника).
  // Для демо-данных достаточно первого совпадения
  for (const row of rows) {
    if (!byName.has(row.name)) byName.set(row.name, row.id)
  }

  console.log(`  метки: ${TAG_SEEDS.length}`)
  return byName
}

/** Кураторы для демо-разборов: берём тех, кто уже есть в базе */
async function findCurators(): Promise<string[]> {
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .orderBy(schema.users.createdAt)
    .limit(3)

  return rows.map((row) => row.id)
}

/**
 * Карточки кураторов.
 *
 * Заводятся показанными: в демо-данных смысл в том, чтобы страница
 * «Кураторы» сразу выглядела заполненной. В настоящей жизни карточка
 * появляется скрытой и человек заполняет её сам.
 */
const DEMO_CURATOR_CARDS = [
  {
    headline: 'Фингерстайл и акустика',
    bio: 'Играю с девяносто восьмого, преподаю с две тысячи четырнадцатого. Люблю, когда простая песня звучит объёмно, и не люблю, когда ученик заучивает движение, не слыша, зачем оно.',
    teaches: ['Перебор', 'Фингерстайл', 'Аранжировка'],
    influences: ['Tommy Emmanuel', 'Пол Маккартни', 'Виктор Зинчук'],
    gear: ['Taylor 314ce', 'Fender Blues Junior'],
    teachingSince: 2014,
  },
  {
    headline: 'Электрогитара, ритм и соло',
    bio: 'Двадцать лет в группах разного калибра. Считаю, что чувство ритма важнее скорости, и первые полгода занятий этим и занимаюсь.',
    teaches: ['Бой', 'Соло', 'Импровизация'],
    influences: ['David Gilmour', 'Metallica', 'Би-2'],
    gear: ['Fender Stratocaster', 'Boss Katana 100'],
    teachingSince: 2011,
  },
  {
    headline: 'С нуля до первой песни',
    bio: 'Работаю с теми, кто держит гитару первый месяц. Задача простая: чтобы человек сыграл целую песню раньше, чем успел разочароваться.',
    teaches: ['Первые аккорды', 'Баррэ', 'Ритм'],
    influences: ['Кино', 'ДДТ', 'Oasis'],
    gear: ['Yamaha F310'],
    teachingSince: 2019,
  },
]

async function seedCuratorCards(curators: string[]): Promise<void> {
  if (curators.length === 0) return

  await db.delete(schema.curatorProfiles).where(inArray(schema.curatorProfiles.userId, curators))

  for (const [index, userId] of curators.entries()) {
    const card = DEMO_CURATOR_CARDS[index % DEMO_CURATOR_CARDS.length]
    if (!card) continue

    const [user] = await db
      .select({ displayName: schema.users.displayName })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1)

    await db.insert(schema.curatorProfiles).values({
      userId,
      slug: `${slugify(user?.displayName ?? 'curator')}-${index + 1}`,
      headline: card.headline,
      bio: card.bio,
      teaches: card.teaches,
      influences: card.influences,
      gear: card.gear,
      teachingSince: card.teachingSince,
      isPublic: true,
      orderIndex: index,
    })
  }

  console.log(`  карточки кураторов: ${curators.length}`)
}

/**
 * Открывает визитки кураторов.
 *
 * Только у них: раскрывать чужие профили демо-скриптом нельзя даже
 * в разработке — согласие на показ визитки даёт человек, а не скрипт.
 * Кураторы здесь исключение постольку, поскольку их карточки и так
 * публичны по смыслу.
 */
async function openDemoProfiles(curators: string[]): Promise<void> {
  if (curators.length === 0) return

  await db
    .update(schema.users)
    .set({ profileVisibility: 'club' })
    .where(inArray(schema.users.id, curators))

  console.log(`  открытых визиток: ${curators.length}`)
}

async function seedSongs(tagIds: Map<string, string>, curators: string[]): Promise<void> {
  const slugs = DEMO_SONGS.map((song) => songSlug(song.artist, song.title))
  let materialCount = 0

  // Пересоздаём целиком: связанные записи уйдут каскадом
  const existing = await db
    .select({ id: schema.songs.id })
    .from(schema.songs)
    .where(inArray(schema.songs.slug, slugs))

  if (existing.length > 0) {
    const ids = existing.map((row) => row.id)

    // Файлы уходят вместе с разборами: записи о материалах привязаны
    // к песням и вариантам, а сами варианты уйдут каскадом
    const arrangementIds = (
      await db
        .select({ id: schema.arrangements.id })
        .from(schema.arrangements)
        .where(inArray(schema.arrangements.songId, ids))
    ).map((row) => row.id)

    const owned = [...ids, ...arrangementIds]
    const assetIds = (
      await db
        .select({ id: schema.attachments.mediaAssetId })
        .from(schema.attachments)
        .where(inArray(schema.attachments.entityId, owned))
    ).map((row) => row.id)

    await db.delete(schema.taggables).where(inArray(schema.taggables.entityId, ids))
    await db.delete(schema.songs).where(inArray(schema.songs.id, ids))

    if (assetIds.length > 0) {
      await db.delete(schema.mediaAssets).where(inArray(schema.mediaAssets.id, assetIds))
    }

    console.log(`  прежние демо-разборы удалены: ${existing.length}`)
  }

  for (const [index, song] of DEMO_SONGS.entries()) {
    const songId = uuidv7()
    const status = song.status ?? 'published'

    await db.insert(schema.songs).values({
      id: songId,
      slug: songSlug(song.artist, song.title),
      title: song.title,
      artist: song.artist,
      album: song.album ?? null,
      year: song.year ?? null,
      description: song.description,
      tuning: song.tuning ?? null,
      capo: song.capo ?? null,
      tempoBpm: song.tempoBpm ?? null,
      musicKey: song.musicKey ?? null,
      status,
      publishedAt: song.publishedAt ?? null,
      popularityScore: (DEMO_SONGS.length - index) * 10,
      createdBy: curators[0] ?? null,
    })

    for (const name of song.tags) {
      const tagId = tagIds.get(name)
      if (!tagId) continue

      await db
        .insert(schema.taggables)
        .values({ tagId, entityType: 'song', entityId: songId })
        .onConflictDoNothing()
    }

    materialCount += await attachMaterials(song.materials, 'song', songId, curators[0] ?? null)

    for (const [order, arrangement] of song.arrangements.entries()) {
      const arrangementId = uuidv7()

      // Видео получает первый вариант первой песни: этого достаточно,
      // чтобы проверить плеер, оглавление и водяной знак
      const videoAssetId =
        index === 0 && order === 0 ? await createDemoVideoAsset(curators[0] ?? null) : null

      await db.insert(schema.arrangements).values({
        id: arrangementId,
        videoAssetId,
        songId,
        level: arrangement.level,
        title: arrangement.title ?? null,
        // Кураторы по кругу: так на странице видно, что разборы разные
        curatorId: curators[order % Math.max(1, curators.length)] ?? null,
        summary: arrangement.summary,
        estimatedMinutes: arrangement.estimatedMinutes,
        orderIndex: order,
        status: arrangement.status ?? 'published',
      })

      await db.insert(schema.arrangementSections).values(
        arrangement.sections.map((section, sectionOrder) => ({
          id: uuidv7(),
          arrangementId,
          title: section.title,
          orderIndex: sectionOrder,
          videoStartSec: section.start,
          videoEndSec: section.end,
        })),
      )

      materialCount += await attachMaterials(
        arrangement.materials,
        'arrangement',
        arrangementId,
        curators[order % Math.max(1, curators.length)] ?? null,
      )
    }
  }

  const total = DEMO_SONGS.reduce((sum, song) => sum + song.arrangements.length, 0)
  console.log(`  разборы: ${DEMO_SONGS.length} песен, ${total} вариантов`)
  console.log(`  материалы: ${materialCount} файлов в .storage`)
  console.log(
    DEMO_VIDEO_ID
      ? `  видео: ролик ${DEMO_VIDEO_ID} привязан к первому разбору`
      : '  видео: DEMO_VIDEO_ID не задан — разборы без роликов',
  )
}

// ─────────────────────────────────────────────────────────────────
// ДЕМОНСТРАЦИОННЫЙ КУРС
//
// Три модуля и восемь уроков. Подобраны так, чтобы задеть все случаи
// карты курса: пройденные и непройденные уроки, модуль без видео,
// черновик, урок без указанной длительности, урок со ссылкой
// на настоящий разбор из этой же базы.
// ─────────────────────────────────────────────────────────────────

const COURSE_SLUG = 'guitar-from-scratch'

type DemoLesson = {
  slug: string
  title: string
  summary: string | null
  minutes: number | null
  status: 'draft' | 'published'
  blocks: unknown[]
}

type DemoModule = {
  slug: string
  title: string
  description: string
  status: 'draft' | 'published'
  lessons: DemoLesson[]
}

const DEMO_MODULES: DemoModule[] = [
  {
    slug: 'first-steps',
    title: 'Первые шаги',
    description: 'Инструмент, посадка, настройка. Отсюда начинают все.',
    status: 'published',
    lessons: [
      {
        slug: 'meet-the-guitar',
        title: 'Знакомство с гитарой',
        summary: 'Как устроен инструмент и что как называется',
        minutes: 8,
        status: 'published',
        blocks: [
          {
            type: 'paragraph',
            text: 'Гитара состоит из корпуса, грифа и головы. Звук рождается от колебания струны и усиливается корпусом — поэтому акустика звучит громче электрогитары без усилителя.',
          },
          { type: 'heading', text: 'Что важно запомнить' },
          {
            type: 'list',
            items: [
              'Лады считаются от головы грифа',
              'Первая струна — самая тонкая',
              'Шестая струна — самая толстая',
            ],
          },
          {
            type: 'tip',
            text: 'Не пугайтесь, если пальцы болят первые две недели. Это нормально: кожа на подушечках грубеет.',
            tone: 'tip',
          },
        ],
      },
      {
        slug: 'tuning',
        title: 'Настройка инструмента',
        summary: 'Стандартный строй и как в него попасть',
        minutes: 12,
        status: 'published',
        blocks: [
          { type: 'paragraph', text: 'Стандартный строй читается от шестой струны к первой.' },
          {
            type: 'chords',
            text: 'E A D G B E',
            caption: 'Стандартный строй, от толстой струны к тонкой',
          },
          {
            type: 'tip',
            text: 'Расстроенная гитара портит слух быстрее, чем неправильная постановка руки портит технику. Настраивайтесь перед каждым занятием.',
            tone: 'warning',
          },
        ],
      },
      {
        slug: 'right-hand',
        title: 'Правая рука: бой и перебор',
        summary: 'Два способа извлечь звук',
        minutes: 15,
        status: 'published',
        blocks: [
          {
            type: 'paragraph',
            text: 'Бой — это удар по всем струнам сразу, перебор — по одной. С боя начинать проще: он прощает неточность.',
          },
          {
            type: 'list',
            ordered: true,
            items: [
              'Расслабьте кисть',
              'Ударьте вниз по всем струнам',
              'Верните руку вверх тем же движением',
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'first-chords',
    title: 'Первые аккорды',
    description: 'Am, Dm, E — с ними уже можно играть песни.',
    status: 'published',
    lessons: [
      {
        slug: 'chord-am',
        title: 'Аккорд Am',
        summary: 'Самый первый аккорд',
        minutes: 10,
        status: 'published',
        blocks: [
          {
            type: 'paragraph',
            text: 'Am — минорный аккорд, звучит грустно и берётся легче остальных.',
          },
          {
            type: 'chords',
            text: 'e|--0--\nB|--1--\nG|--2--\nD|--2--\nA|--0--\nE|--x--',
            caption: 'Am',
          },
        ],
      },
      {
        slug: 'chord-changes',
        title: 'Переходы между аккордами',
        summary: 'Главная трудность первого месяца',
        minutes: 20,
        status: 'published',
        blocks: [
          {
            type: 'paragraph',
            text: 'Скорость перехода важнее чистоты звука. Сначала научитесь менять аккорд вовремя, потом — чисто.',
          },
          {
            type: 'tip',
            text: 'Ставьте пальцы не по одному, а всей формой сразу. Это единственный способ разогнаться.',
            tone: 'tip',
          },
        ],
      },
      {
        slug: 'first-song',
        title: 'Первая песня целиком',
        summary: 'Собираем всё вместе',
        minutes: null,
        status: 'published',
        blocks: [
          { type: 'paragraph', text: 'Пора применить всё, что вы освоили, на настоящей песне.' },
          { type: 'song', songId: '__DEMO_SONG_ID__', note: 'Начните с уровня Beginner' },
        ],
      },
    ],
  },
  {
    slug: 'barre',
    title: 'Баррэ',
    description: 'Барьер, о который спотыкаются все.',
    status: 'published',
    lessons: [
      {
        slug: 'barre-basics',
        title: 'Как прижать все струны',
        summary: 'Механика, а не сила',
        minutes: 18,
        status: 'published',
        blocks: [
          {
            type: 'paragraph',
            text: 'Баррэ берётся не силой пальца, а положением большого пальца сзади грифа.',
          },
          {
            type: 'tip',
            text: 'Если через минуту рука устала — вы давите, а не держите. Отдохните и попробуйте иначе.',
            tone: 'warning',
          },
        ],
      },
      {
        slug: 'barre-practice',
        title: 'Упражнения на баррэ',
        summary: 'Черновик: куратор ещё пишет',
        minutes: 14,
        status: 'draft',
        blocks: [{ type: 'paragraph', text: 'Черновик урока — виден только кураторам.' }],
      },
    ],
  },
]

async function seedCourse(): Promise<void> {
  // Пересоздаём целиком: скрипт можно запускать повторно
  const existing = await db
    .select({ id: schema.courses.id })
    .from(schema.courses)
    .where(inArray(schema.courses.slug, [COURSE_SLUG]))

  if (existing.length > 0) {
    await db.delete(schema.courses).where(
      inArray(
        schema.courses.id,
        existing.map((row) => row.id),
      ),
    )
  }

  // Ссылка на настоящий разбор из этой же базы: блок «связанный разбор»
  // проверяется только на существующей песне
  const [firstSong] = await db.select({ id: schema.songs.id }).from(schema.songs).limit(1)

  const courseId = uuidv7()

  await db.insert(schema.courses).values({
    id: courseId,
    slug: COURSE_SLUG,
    title: 'Гитара с нуля',
    description: 'Путь от первого прикосновения к струнам до песни, сыгранной целиком.',
    status: 'published',
    orderIndex: 0,
    publishedAt: new Date(),
  })

  let lessonCount = 0

  for (const [moduleOrder, module] of DEMO_MODULES.entries()) {
    const moduleId = uuidv7()

    await db.insert(schema.courseModules).values({
      id: moduleId,
      courseId,
      slug: module.slug,
      title: module.title,
      description: module.description,
      orderIndex: moduleOrder,
      status: module.status,
    })

    for (const [lessonOrder, lesson] of module.lessons.entries()) {
      const blocks = lesson.blocks
        .map((block) => {
          const record = block as Record<string, unknown>
          if (record.songId !== '__DEMO_SONG_ID__') return block
          // Песни в базе нет — блок со ссылкой просто пропускаем
          return firstSong ? { ...record, songId: firstSong.id } : null
        })
        .filter((block) => block !== null)

      await db.insert(schema.lessons).values({
        id: uuidv7(),
        moduleId,
        slug: lesson.slug,
        title: lesson.title,
        summary: lesson.summary,
        content: blocks,
        estimatedMinutes: lesson.minutes,
        orderIndex: lessonOrder,
        status: lesson.status,
        publishedAt: lesson.status === 'published' ? new Date() : null,
      })

      lessonCount += 1
    }
  }

  console.log(`  курс: ${DEMO_MODULES.length} модуля, ${lessonCount} уроков`)
}

// ─────────────────────────────────────────────────────────────────
// ДЕМОНСТРАЦИОННЫЕ ЭФИРЫ
//
// Пять штук, подобранных так, чтобы задеть все состояния сразу:
// запланированный, идущий прямо сейчас, прошедший без записи, запись
// с оглавлением и разобранными песнями, отменённый.
//
// Даты считаются от текущего момента, а не записаны числами: иначе
// через неделю все «ближайшие» эфиры окажутся в прошлом, и проверять
// экран ближайших будет нечем.
// ─────────────────────────────────────────────────────────────────

type DemoStream = {
  slug: string
  title: string
  description: string
  offsetHours: number
  state: 'scheduled' | 'live' | 'recorded' | 'cancelled'
  status: 'draft' | 'published'
  withVideo?: boolean
  chapters?: { title: string; startSec: number }[]
  songTitles?: string[]
  materials?: DemoMaterial[]
}

const DEMO_STREAMS: DemoStream[] = [
  {
    slug: 'razbor-oshibok-avgust',
    title: 'Разбор ошибок: бой и ритм',
    description: 'Смотрим ваши записи, разбираем типичные ошибки в правой руке.',
    offsetHours: 72,
    state: 'scheduled',
    status: 'published',
  },
  {
    slug: 'voprosy-otvety',
    title: 'Вопросы и ответы',
    description: 'Открытый эфир: спрашивайте о чём угодно.',
    offsetHours: -0.5,
    state: 'live',
    status: 'published',
  },
  {
    slug: 'barre-bez-boli',
    title: 'Баррэ без боли',
    description: 'Механика прижатия, положение большого пальца, упражнения.',
    offsetHours: -30,
    state: 'recorded',
    status: 'published',
  },
  {
    slug: 'metallica-vecher',
    title: 'Вечер Metallica',
    description: 'Разбираем культовые риффы и говорим о звуке.',
    offsetHours: -24 * 9,
    state: 'recorded',
    status: 'published',
    withVideo: true,
    chapters: [
      { title: 'Приветствие и план', startSec: 0 },
      { title: 'Nothing Else Matters: вступление', startSec: 320 },
      { title: 'Перебор правой рукой', startSec: 1180 },
      { title: 'Соло: разбор по фразам', startSec: 2640 },
      { title: 'Ответы на вопросы', startSec: 4500 },
    ],
    songTitles: ['Nothing Else Matters'],
    materials: [{ kind: 'pdf', title: 'Конспект эфира' }],
  },
  {
    slug: 'otmenennyy-efir',
    title: 'Фингерстайл для начинающих',
    description: 'Перенесён: куратор заболел.',
    offsetHours: -24 * 3,
    state: 'cancelled',
    status: 'published',
  },
]

async function seedStreams(curators: string[]): Promise<void> {
  const slugs = DEMO_STREAMS.map((stream) => stream.slug)

  // Пересоздаём целиком: скрипт можно запускать повторно
  await db.delete(schema.streams).where(inArray(schema.streams.slug, slugs))

  const allSongs = await db
    .select({ id: schema.songs.id, title: schema.songs.title })
    .from(schema.songs)

  let withVideo = 0

  for (const [index, stream] of DEMO_STREAMS.entries()) {
    const id = uuidv7()
    const startsAt = new Date(Date.now() + stream.offsetHours * 60 * 60 * 1000)

    // Ролик берём тот же, что у разборов: своего видео у демо-данных нет,
    // а без него не проверить ни плеер, ни переход по оглавлению
    let videoAssetId: string | null = null

    if (stream.withVideo && DEMO_VIDEO_ID) {
      videoAssetId = uuidv7()

      await db.insert(schema.mediaAssets).values({
        id: videoAssetId,
        kind: 'video',
        provider: 'kinescope',
        externalId: DEMO_VIDEO_ID,
        title: stream.title,
        processingStatus: 'ready',
        isDownloadable: false,
        uploadedBy: curators[0] ?? null,
      })

      withVideo += 1
    }

    await db.insert(schema.streams).values({
      id,
      slug: stream.slug,
      title: stream.title,
      description: stream.description,
      curatorId: curators[index % Math.max(1, curators.length)] ?? null,
      startsAt,
      state: stream.state,
      status: stream.status,
      joinUrl: stream.state === 'scheduled' || stream.state === 'live' ? 'https://t.me/' : null,
      videoAssetId,
      publishedAt: stream.status === 'published' ? new Date() : null,
    })

    for (const [order, chapter] of (stream.chapters ?? []).entries()) {
      await db.insert(schema.streamChapters).values({
        id: uuidv7(),
        streamId: id,
        title: chapter.title,
        startSec: chapter.startSec,
        orderIndex: order,
      })
    }

    for (const title of stream.songTitles ?? []) {
      const song = allSongs.find((item) => item.title === title)
      if (song) await db.insert(schema.streamSongs).values({ streamId: id, songId: song.id })
    }

    // Материалы привязываются той же полиморфной таблицей, что у разборов:
    // эфирам не понадобилось ни своей таблицы, ни своей загрузки
    await attachMaterials(stream.materials, 'stream', id, curators[0] ?? null)
  }

  console.log(
    `  эфиры: ${DEMO_STREAMS.length}` +
      (withVideo > 0
        ? `, из них с роликом: ${withVideo}`
        : ', без роликов (DEMO_VIDEO_ID не задан)'),
  )
}

try {
  console.log('Создаю демонстрационное содержимое…')

  const curators = await findCurators()
  if (curators.length === 0) {
    console.log('  ⚠️  в базе нет участников — разборы останутся без кураторов')
    console.log('     сначала выполните pnpm db:seed с заданным OWNER_TELEGRAM_ID')
  }

  const tagIds = await ensureTags()
  await seedSongs(tagIds, curators)

  await seedCourse()
  await seedStreams(curators)
  await seedCuratorCards(curators)
  await openDemoProfiles(curators)

  console.log('Готово. Каталог: /app/learn/songs')
} catch (error) {
  console.error('\nНе удалось создать демонстрационное содержимое.')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
} finally {
  await client.end()
}
