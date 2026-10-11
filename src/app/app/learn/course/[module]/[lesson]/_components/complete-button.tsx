'use client'

import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { courseStrings } from '@/modules/course'
import { Button } from '@/ui'

import { markLessonAction } from '../../../_actions/progress'

/**
 * Кнопка «Урок пройден».
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ОТМЕТКА ПОКА ТОЛЬКО РУЧНАЯ
 *
 * Правило «пройдено при 90% просмотра» написано и покрыто тестами
 * ещё на шаге 6.1, но автоматическая отметка требует событий от плеера
 * видеохостинга. Их подключение идёт вместе с запоминанием места
 * остановки — это шаг 6.3, где то и другое нужно одновременно.
 *
 * До тех пор кнопка — единственный способ, и она всё равно останется
 * навсегда: человек, посмотревший урок с телефона на кухне, должен
 * иметь возможность сказать «прошёл». Ручная отметка автоматикой
 * не снимается (ADR-0019).
 * ─────────────────────────────────────────────────────────────────
 */

type CompleteButtonProps = {
  lessonId: string
  moduleSlug: string
  lessonSlug: string
  completed: boolean
}

export function CompleteButton({
  lessonId,
  moduleSlug,
  lessonSlug,
  completed,
}: CompleteButtonProps) {
  const router = useRouter()
  const [isDone, setIsDone] = useState(completed)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle(): void {
    const next = !isDone

    // Показываем результат сразу: отметка — действие без последствий,
    // и ждать ответа сервера ради галочки человеку незачем
    setIsDone(next)
    setError(null)

    startTransition(async () => {
      const result = await markLessonAction({
        lessonId,
        completed: next,
        moduleSlug,
        lessonSlug,
      })

      if (!result.ok) {
        // Не получилось — возвращаем как было, иначе человек уйдёт
        // с уверенностью, что урок засчитан
        setIsDone(!next)
        setError(result.message)
        return
      }

      router.refresh()
    })
  }

  return (
    <div>
      <Button
        onClick={toggle}
        disabled={pending}
        variant={isDone ? 'secondary' : 'primary'}
        size="lg"
      >
        {isDone ? <Check size={18} aria-hidden /> : null}
        {isDone ? courseStrings.lesson.undoComplete : courseStrings.lesson.complete}
      </Button>

      {error ? (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
