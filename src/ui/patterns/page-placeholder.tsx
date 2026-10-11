/**
 * Заглушка ещё не реализованной страницы.
 *
 * Используется, пока страницы не наполнены содержимым: по каркасу можно
 * кликать и проверять структуру продукта целиком, не дожидаясь, пока
 * будет готов последний экран.
 *
 * В закрытой зоне применяется не этот компонент, а одноимённый из
 * `src/app/app/_components/`: там к заглушке добавляются навигационная
 * цепочка и общий заголовок, а они знают о структуре платформы — знание,
 * которому в дизайн-системе не место.
 */

type StageNoteProps = {
  /** Когда экран будет реализован: «Этап 5» */
  stage: string
  /** Значения параметров адреса, если страница динамическая */
  values?: { label: string; value: string }[] | undefined
}

/**
 * Пометка «здесь будет то-то, этап такой-то».
 *
 * Вынесена отдельно, чтобы заглушки открытой и закрытой зоны выглядели
 * одинаково, не повторяя разметку дважды.
 */
export function StageNote({ stage, values }: StageNoteProps) {
  return (
    <div className="border-border text-content-muted rounded-lg border border-dashed px-4 py-3">
      <p className="text-xs tracking-wide uppercase">Появится на этапе: {stage}</p>

      {values?.length ? (
        <dl className="mt-2 font-mono text-xs">
          {values.map((item) => (
            <div key={item.label} className="flex gap-2">
              <dt className="opacity-60">{item.label}:</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}

type PagePlaceholderProps = StageNoteProps & {
  /** Название экрана, как оно будет выглядеть для участника */
  title: string
  /** Что здесь будет */
  description?: string | undefined
}

export function PagePlaceholder({ title, stage, description, values }: PagePlaceholderProps) {
  return (
    <section className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-3xl font-extrabold">{title}</h1>
      {description ? <p className="text-content-muted mt-2">{description}</p> : null}

      <div className="mt-6">
        <StageNote stage={stage} values={values} />
      </div>
    </section>
  )
}
