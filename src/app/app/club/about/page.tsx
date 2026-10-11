import { getSetting, SETTING_KEYS } from '@/modules/settings'
import type { ClubAbout } from '@/modules/settings'
import { routes } from '@/shared/routes'
import { PillLink } from '@/ui'

import { PageIntro } from '../../_components/page-intro'

export const metadata = { title: 'О клубе' }

/**
 * Страница «О клубе».
 *
 * ─────────────────────────────────────────────────────────────────
 * БЛОКИ, А НЕ СТАТЬЯ
 *
 * Соблазн — одно большое поле с разметкой: пиши что хочешь. Отвергнуто.
 * Свободный текст означает, что человек без разработчика может сломать
 * вёрстку страницы, которую первой видит новичок. Блоки заданной формы
 * сломать нельзя — можно только заполнить.
 *
 * Заодно это отвечает на вопрос «а что вообще писать»: пустые поля
 * «три тезиса о клубе» и «четыре шага обучения» подсказывают структуру
 * лучше, чем чистый лист.
 * ─────────────────────────────────────────────────────────────────
 *
 * Содержимое живёт в настройках платформы и заполнено по умолчанию:
 * встретить новичка пустой страницей нельзя.
 */
export default async function AboutClubPage() {
  const about = await getSetting<ClubAbout>(SETTING_KEYS.clubAbout)

  return (
    <>
      <PageIntro title="О клубе" />

      {about.intro ? <p className="mb-10 max-w-prose text-lg">{about.intro}</p> : null}

      {about.points.length > 0 ? (
        <ul className="mb-12 grid gap-4 sm:grid-cols-3">
          {about.points.map((point) => (
            <li key={point.title} className="border-border bg-surface-raised rounded-xl border p-5">
              <p className="font-display mb-2 text-lg font-bold">{point.title}</p>
              <p className="text-content-muted text-sm">{point.text}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {about.steps.length > 0 ? (
        <section className="mb-12">
          <h2 className="font-display mb-4 text-xl font-bold">Как устроено обучение</h2>

          {/* Нумерованный список, а не схема со стрелками: порядок здесь
              и есть смысл, а стрелки на телефоне складываются в столбик
              и перестают что-либо означать */}
          <ol className="border-border divide-border divide-y overflow-hidden rounded-lg border">
            {about.steps.map((step, index) => (
              <li key={step.title} className="flex gap-4 px-5 py-4">
                <span className="text-content-subtle w-5 shrink-0 tabular-nums">{index + 1}</span>
                <span>
                  <span className="block font-medium">{step.title}</span>
                  <span className="text-content-muted block text-sm">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {about.schedule ? (
        <section className="mb-12">
          <h2 className="font-display mb-3 text-xl font-bold">Когда проходят эфиры</h2>
          <p className="text-content-muted mb-4 max-w-prose">{about.schedule}</p>
          <PillLink href={routes.app.streams.upcoming()}>Ближайшие эфиры</PillLink>
        </section>
      ) : null}

      {about.questions.length > 0 ? (
        <section className="mb-12">
          <h2 className="font-display mb-4 text-xl font-bold">Частые вопросы</h2>

          {/* Раскрывающийся список средствами браузера: ни строчки кода
              в браузере, работает с клавиатуры и читается диктором */}
          <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
            {about.questions.map((item) => (
              <details key={item.question} className="group">
                <summary className="hover:bg-surface-hover flex min-h-14 cursor-pointer items-center px-5 py-3 font-medium">
                  {item.question}
                </summary>
                <p className="text-content-muted px-5 pb-4 text-sm">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <PillLink href={routes.app.club.telegram()}>Чаты клуба</PillLink>
        <PillLink href={routes.app.club.curators()}>Кураторы</PillLink>
      </div>
    </>
  )
}
