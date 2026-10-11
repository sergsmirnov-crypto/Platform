import { StageNote } from '@/ui'

import { PageIntro } from './page-intro'

/**
 * Заглушка страницы закрытой зоны.
 *
 * От заглушки открытой зоны отличается одним: сверху появляются
 * навигационная цепочка и общий заголовок. Благодаря этому каркас
 * платформы уже сейчас ведёт себя так, как будет вести готовая:
 * по пути наверх можно кликать, заголовки везде одинаковые.
 *
 * Заменяется настоящим содержимым по мере прохождения этапов. Порядок
 * замены: убрать `StageNote`, оставить `PageIntro`, добавить содержимое.
 */

type PagePlaceholderProps = {
  /** Название экрана, как его увидит участник */
  title: string
  /** Когда экран будет реализован: «Этап 5» */
  stage: string
  /** Что здесь будет */
  description?: string | undefined
  /** Значения параметров адреса, если страница динамическая */
  values?: { label: string; value: string }[] | undefined
}

export function PagePlaceholder({ title, stage, description, values }: PagePlaceholderProps) {
  return (
    <>
      <PageIntro title={title} description={description} />
      <div className="max-w-2xl">
        <StageNote stage={stage} values={values} />
      </div>
    </>
  )
}
