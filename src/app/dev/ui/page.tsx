import { notFound } from 'next/navigation'

import {
  Badge,
  Button,
  Card,
  CardActions,
  CardBody,
  CardMeta,
  CardTitle,
  EmptyState,
  Field,
  Input,
  PageHeader,
  ProgressMarker,
  Skeleton,
  Textarea,
  Wave,
} from '@/ui'
import { ThemeToggle } from '@/ui/theme/theme-toggle'

/**
 * Витрина дизайн-системы.
 *
 * Заменяет собой Storybook: все элементы на одной странице, в обеих темах,
 * без двух дней настройки отдельного инструмента и лишних зависимостей.
 *
 * Доступна только при локальной разработке.
 */

export const metadata = { title: 'Дизайн-система' }

function Section({
  title,
  note,
  children,
}: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-border border-t py-10">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {note ? <p className="text-content-muted mt-1 max-w-2xl text-sm">{note}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  )
}

function Swatch({ name, token, hint }: { name: string; token: string; hint?: string }) {
  return (
    <div>
      <div
        className="border-border h-16 w-full rounded-md border"
        style={{ backgroundColor: `var(${token})` }}
      />
      <p className="mt-2 text-sm font-medium">{name}</p>
      <code className="text-content-subtle text-xs">{token}</code>
      {hint ? <p className="text-content-muted mt-1 text-xs">{hint}</p> : null}
    </div>
  )
}

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <PageHeader
        eyebrow="Шаг F5"
        title="Дизайн-система"
        description="Все элементы платформы на одной странице. Переключите тему — всё должно оставаться читаемым."
        actions={<ThemeToggle />}
      />

      <Section
        title="Цвета"
        note="Фирменный жёлтый — акцент, а не фон: платформой пользуются часами, а не сорок секунд. Правило без исключений: на жёлтом всегда чёрный текст."
      >
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <Swatch name="Акцент" token="--accent" hint="Главные кнопки, активные состояния" />
          <Swatch name="Акцент мягкий" token="--accent-soft" hint="Подсветка маркером, прогресс" />
          <Swatch name="Опасное действие" token="--danger" hint="Одно на экран, не больше" />
          <Swatch name="Успех" token="--success" />
          <Swatch name="Фон" token="--surface" />
          <Swatch name="Карточка" token="--surface-raised" />
          <Swatch name="Утопленный фон" token="--surface-sunken" />
          <Swatch name="Граница" token="--border" />
        </div>

        <div className="bg-accent text-accent-content mt-6 rounded-md p-4">
          <p className="font-medium">Чёрный на жёлтом — читается.</p>
          <p className="text-sm opacity-80">Контраст 13:1 при требуемых 4,5:1.</p>
        </div>
        <div className="bg-accent mt-2 rounded-md p-4" style={{ color: '#fff' }}>
          <p className="font-medium">Белый на жёлтом — так не делаем никогда.</p>
          <p className="text-sm">Контраст 1,6:1. Пример здесь только чтобы разница была видна.</p>
        </div>
      </Section>

      <Section
        title="Шрифты"
        note="Onest в заголовках даёт плакатный эффект, как в «Табы от Вани!». Golos Text сделан под русский язык и хорошо читается в мелком кегле. Оба лежат в проекте и раздаются с нашего сервера — важно для участников из США и Сербии."
      >
        <div className="space-y-4">
          <p className="font-display text-5xl font-extrabold">Разборы</p>
          <p className="font-display text-3xl font-extrabold">Nothing Else Matters</p>
          <p className="font-display text-xl font-bold">Структура разбора</p>
          <p className="text-content-muted text-xs font-semibold tracking-[0.08em] uppercase">
            Надзаголовок раздела
          </p>
          <p className="max-w-xl">
            Обычный текст. Metallica, 1991 год. Строй E standard, темп 72 удара в минуту,
            тональность Em. Куратор — Иван Петров.
          </p>
          <p className="text-content-muted max-w-xl text-sm">
            Второстепенный текст: подписи, подсказки, свойства.
          </p>
        </div>
      </Section>

      <Section
        title="Фирменный приём: подсветка маркером"
        note="Взят из логотипа «Ваня, научи!». На платформе тот же приём работает индикатором прогресса — заливка проходит по названию по мере прохождения частей. Приём из бренда становится функцией."
      >
        <div className="space-y-5">
          <p className="font-display text-2xl font-bold">
            <span className="marker-highlight">Ваня, научи!</span>
          </p>
          <div className="space-y-3">
            <p className="font-display text-xl font-bold">
              <ProgressMarker value={0} label="Не начато">
                Nothing Else Matters
              </ProgressMarker>
              <span className="text-content-muted ml-3 text-sm font-normal">не начато</span>
            </p>
            <p className="font-display text-xl font-bold">
              <ProgressMarker value={0.5} label="3 из 6 частей">
                Nothing Else Matters
              </ProgressMarker>
              <span className="text-content-muted ml-3 text-sm font-normal">3 из 6 частей</span>
            </p>
            <p className="font-display text-xl font-bold">
              <ProgressMarker value={1} label="Разобрано полностью">
                Nothing Else Matters
              </ProgressMarker>
              <span className="text-content-muted ml-3 text-sm font-normal">разобрано</span>
            </p>
          </div>
        </div>
      </Section>

      <Section
        title="Кнопки"
        note="Главное действие на экране одно. Красный означает «пути назад нет»."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button>Продолжить</Button>
          <Button variant="secondary">Табы</Button>
          <Button variant="ghost">Отмена</Button>
          <Button variant="danger">Удалить разбор</Button>
          <Button disabled>Недоступно</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm">Мелкая</Button>
          <Button size="md">Обычная</Button>
          <Button size="lg">Крупная</Button>
        </div>
      </Section>

      <Section title="Метки" note="Уровень различается текстом, а не только цветом.">
        <div className="flex flex-wrap gap-2">
          <Badge>Beginner</Badge>
          <Badge>Intermediate</Badge>
          <Badge variant="accent">Новое</Badge>
          <Badge variant="outline">E standard</Badge>
          <Badge variant="outline">Капо II</Badge>
          <Badge variant="draft">Черновик</Badge>
          <Badge variant="danger">Подписка истекла</Badge>
        </div>
      </Section>

      <Section
        title="Карточка разбора"
        note="Структура — с карточек табов на сайте. Отличие принципиальное: там кнопка звала купить, здесь — вернуться туда, где человек остановился."
      >
        <div className="grid gap-5 sm:grid-cols-3">
          <Card>
            <div className="bg-surface-sunken flex aspect-square items-center justify-center">
              <span className="text-content-subtle text-xs">обложка</span>
            </div>
            <CardBody>
              <CardMeta>Metallica</CardMeta>
              <CardTitle>Nothing Else Matters</CardTitle>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge size="sm">Intermediate</Badge>
                <Badge size="sm" variant="outline">
                  E standard
                </Badge>
              </div>
              <p className="text-content-muted mt-3 text-sm">
                <span className="marker-highlight">3 из 6 частей</span>
              </p>
              <CardActions>
                <Button size="sm" fullWidth>
                  Продолжить
                </Button>
                <Button size="sm" variant="secondary" fullWidth>
                  Табы
                </Button>
              </CardActions>
            </CardBody>
          </Card>

          <Card>
            <div className="bg-surface-sunken flex aspect-square items-center justify-center">
              <span className="text-content-subtle text-xs">обложка</span>
            </div>
            <CardBody>
              <CardMeta>Кино</CardMeta>
              <CardTitle>Перемен</CardTitle>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge size="sm">Beginner</Badge>
                <Badge size="sm" variant="outline">
                  Капо II
                </Badge>
              </div>
              <p className="text-content-muted mt-3 text-sm">не начато</p>
              <CardActions>
                <Button size="sm" fullWidth>
                  Открыть разбор
                </Button>
                <Button size="sm" variant="secondary" fullWidth>
                  Табы
                </Button>
              </CardActions>
            </CardBody>
          </Card>

          <Card>
            <Skeleton className="aspect-square rounded-none" />
            <CardBody>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-5 w-full" />
              <Skeleton className="mt-3 h-6 w-24 rounded-full" />
              <Skeleton className="mt-4 h-11 w-full rounded-full" />
            </CardBody>
          </Card>
        </div>
      </Section>

      <Section title="Формы">
        <div className="max-w-md">
          <Field label="Название песни" htmlFor="title" hint="Как она называется в оригинале">
            <Input id="title" placeholder="Nothing Else Matters" />
          </Field>
          <Field
            label="Исполнитель"
            htmlFor="artist"
            error="Укажите исполнителя — по нему работает поиск в каталоге"
          >
            <Input id="artist" aria-invalid placeholder="Metallica" />
          </Field>
          <Field label="Описание разбора" htmlFor="desc" hint="Два-три абзаца: что человек освоит">
            <Textarea id="desc" placeholder="В этом разборе разбираем перебор…" />
          </Field>
        </div>
      </Section>

      <Section
        title="Пустое состояние"
        note="Пустой экран — приглашение к действию, а не сообщение «здесь ничего нет»."
      >
        <Card>
          <EmptyState
            title="Разборов пока нет"
            description="Как только куратор опубликует первый разбор, он появится здесь."
            action={<Button variant="secondary">Посмотреть курс</Button>}
          />
        </Card>
      </Section>

      <Section
        title="Волна"
        note="С сайта-витрины. Применяется дозированно: экран входа, шапка главной, экран «подписка закончилась». На каждой странице превратилась бы в шум."
      >
        <div className="overflow-hidden rounded-lg">
          <div className="bg-accent px-6 pt-10">
            <p className="font-display text-accent-content text-3xl font-extrabold">
              Гитарный клуб
            </p>
            <p className="text-accent-content/70 mt-2 pb-6 text-sm">
              Разборы, курс и эфиры — в одном месте
            </p>
          </div>
          <Wave className="text-accent rotate-180" />
        </div>
      </Section>
    </main>
  )
}
