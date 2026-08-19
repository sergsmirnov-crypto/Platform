// Именно из отдельных файлов, а не из публичного входа модуля: тот
// re-экспортирует серверный код, и сборка браузерной части падает.
// Тот же приём уже применён в форме профиля
import { ONBOARDING_QUESTION_COUNT } from '@/modules/identity/onboarding'
import { onboardingStrings } from '@/modules/identity/onboarding-strings'

/**
 * Оболочка шага знакомства.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ЗНАКОМСТВО ВЫГЛЯДИТ НЕ КАК ОСТАЛЬНАЯ ПЛАТФОРМА
 *
 * Здесь нет ни бокового меню, ни шапки, ни нижней панели. Это сделано
 * намеренно и работает против привычного правила «интерфейс везде
 * одинаковый».
 *
 * Причина: меню на экране знакомства предлагает уйти. Человек, впервые
 * открывший платформу, нажмёт «Эфиры», попадёт в пустой список, потому что
 * подписка только оформлена и он ничего не смотрел, — и первое впечатление
 * сложится именно там. Знакомство длится четыре экрана и заканчивается
 * кнопкой на разбор; всё это время платформа должна вести, а не предлагать
 * выбор.
 * ─────────────────────────────────────────────────────────────────
 */
export function StepShell({
  title,
  description,
  questionNumber,
  children,
}: {
  title: string
  description?: string
  /** `null` на согласии и на итоговом экране — там индикатора нет */
  questionNumber: number | null
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-xl px-5 py-10 sm:py-16">
      {questionNumber === null ? null : (
        <StepProgress current={questionNumber} total={ONBOARDING_QUESTION_COUNT} />
      )}

      <h1 className="mt-6 text-2xl font-bold sm:text-3xl">{title}</h1>
      {description ? <p className="text-content-muted mt-2">{description}</p> : null}

      <div className="mt-8">{children}</div>
    </div>
  )
}

/**
 * Индикатор прогресса.
 *
 * Полоски, а не «шаг 2 из 4» одним текстом: при четырёх шагах полоски
 * читаются мгновенно и показывают, что осталось немного. Текст рядом
 * оставлен для тех, кто пользуется чтением с экрана, — для них полоски
 * ничего не значат.
 */
function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div>
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={
              index < current
                ? 'bg-accent h-1 flex-1 rounded-full'
                : 'bg-border h-1 flex-1 rounded-full'
            }
          />
        ))}
      </div>

      <p className="text-content-subtle mt-2 text-xs">
        {onboardingStrings.progress(current, total)}
      </p>
    </div>
  )
}

/**
 * Кнопки внизу шага.
 *
 * «Пропустить» слева и неброско, «Дальше» справа и заметно: пропуск нужен,
 * но предлагать его наравне с ответом значит подсказывать, что отвечать
 * необязательно. При этом прятать его нельзя — человек, не желающий
 * рассказывать о себе, должен видеть выход, а не искать его.
 */
export function StepActions({
  onSkip,
  pending,
  submitLabel,
}: {
  onSkip?: (() => void) | undefined
  pending: boolean
  submitLabel?: string | undefined
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-4">
      {onSkip ? (
        <button
          type="button"
          onClick={onSkip}
          disabled={pending}
          className="text-content-muted min-h-11 text-sm underline disabled:opacity-50"
        >
          {onboardingStrings.skip}
        </button>
      ) : (
        <span />
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-accent text-accent-content min-h-11 rounded-full px-6 text-sm font-medium disabled:opacity-50"
      >
        {pending ? onboardingStrings.saving : (submitLabel ?? onboardingStrings.next)}
      </button>
    </div>
  )
}
