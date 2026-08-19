import { routes } from '@/shared/routes'
import { LinkButton, PageHeader } from '@/ui'

/**
 * Страница «не найдено».
 *
 * Не тупик, а развилка: у человека всегда есть куда пойти дальше.
 */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <PageHeader
        eyebrow="Страница не найдена"
        title="Здесь ничего нет"
        description="Возможно, материал переехал или ссылка устарела."
      />
      <div className="flex flex-wrap gap-3">
        <LinkButton href={routes.app.dashboard()}>На главную</LinkButton>
        <LinkButton href={routes.app.learn.songs()} variant="secondary">
          К разборам
        </LinkButton>
      </div>
    </main>
  )
}
