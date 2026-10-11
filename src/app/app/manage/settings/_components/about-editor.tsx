'use client'

import { Trash2 } from 'lucide-react'
import { useState } from 'react'

import type { ClubAbout, ClubPoint, ClubQuestion } from '@/modules/settings/catalog'
import { settingsStrings } from '@/modules/settings/strings'
import { Button, Field, Input, Textarea } from '@/ui'

import { SettingCard } from './setting-card'

/**
 * Редактор страницы «О клубе».
 *
 * ─────────────────────────────────────────────────────────────────
 * БЛОКИ, А НЕ СВОБОДНЫЙ ТЕКСТ
 *
 * Соблазн дать сюда редактор с разметкой велик: «пусть пишут что
 * хотят». Но страница «О клубе» — первое, что открывает новичок,
 * и человек без разработчика, случайно оставивший незакрытый тег
 * или вставивший текст из Word, сломает её для всех сразу.
 *
 * Блоки заданной формы сломать нельзя — можно только заполнить.
 * Цена — меньше свободы; выигрыш — страница, которая всегда выглядит
 * прилично.
 * ─────────────────────────────────────────────────────────────────
 */

const strings = settingsStrings.about

export function AboutEditor({ value }: { value: ClubAbout }) {
  const [about, setAbout] = useState<ClubAbout>(value)

  function patch(changes: Partial<ClubAbout>) {
    setAbout((current) => ({ ...current, ...changes }))
  }

  return (
    <SettingCard
      settingKey="club.about"
      title={strings.title}
      hint={strings.hint}
      getValue={() => about}
    >
      <Field label={strings.intro} htmlFor="about-intro">
        <Textarea
          id="about-intro"
          value={about.intro}
          onChange={(event) => patch({ intro: event.target.value })}
          rows={3}
        />
      </Field>

      <PointList
        title={strings.points}
        addLabel={strings.addPoint}
        items={about.points}
        onChange={(points) => patch({ points })}
      />

      <PointList
        title={strings.steps}
        addLabel={strings.addStep}
        items={about.steps}
        onChange={(steps) => patch({ steps })}
      />

      <Field label={strings.schedule} htmlFor="about-schedule">
        <Input
          id="about-schedule"
          value={about.schedule}
          onChange={(event) => patch({ schedule: event.target.value })}
        />
      </Field>

      <QuestionList items={about.questions} onChange={(questions) => patch({ questions })} />
    </SettingCard>
  )
}

/** Список тезисов: «что такое клуб» и «как устроено обучение» устроены одинаково */
function PointList({
  title,
  addLabel,
  items,
  onChange,
}: {
  title: string
  addLabel: string
  items: ClubPoint[]
  onChange: (items: ClubPoint[]) => void
}) {
  return (
    <fieldset className="border-border space-y-3 rounded-md border p-4">
      <legend className="px-1 text-sm font-medium">{title}</legend>

      {items.map((item, index) => (
        <div key={index} className="grid items-end gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <Field label={strings.pointTitle} htmlFor={`${title}-title-${index}`}>
            <Input
              id={`${title}-title-${index}`}
              value={item.title}
              onChange={(event) =>
                onChange(replaceAt(items, index, { ...item, title: event.target.value }))
              }
            />
          </Field>

          <Field label={strings.pointText} htmlFor={`${title}-text-${index}`}>
            <Input
              id={`${title}-text-${index}`}
              value={item.text}
              onChange={(event) =>
                onChange(replaceAt(items, index, { ...item, text: event.target.value }))
              }
            />
          </Field>

          <Button variant="ghost" size="sm" onClick={() => onChange(removeAt(items, index))}>
            <Trash2 size={14} aria-hidden />
          </Button>
        </div>
      ))}

      {items.length < 6 ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange([...items, { title: '', text: '' }])}
        >
          {addLabel}
        </Button>
      ) : null}
    </fieldset>
  )
}

function QuestionList({
  items,
  onChange,
}: {
  items: ClubQuestion[]
  onChange: (items: ClubQuestion[]) => void
}) {
  return (
    <fieldset className="border-border space-y-3 rounded-md border p-4">
      <legend className="px-1 text-sm font-medium">{strings.questions}</legend>

      {items.map((item, index) => (
        <div key={index} className="space-y-2">
          <Field label={strings.question} htmlFor={`question-${index}`}>
            <Input
              id={`question-${index}`}
              value={item.question}
              onChange={(event) =>
                onChange(replaceAt(items, index, { ...item, question: event.target.value }))
              }
            />
          </Field>

          <Field label={strings.answer} htmlFor={`answer-${index}`}>
            <Textarea
              id={`answer-${index}`}
              value={item.answer}
              onChange={(event) =>
                onChange(replaceAt(items, index, { ...item, answer: event.target.value }))
              }
              rows={2}
            />
          </Field>

          <Button variant="ghost" size="sm" onClick={() => onChange(removeAt(items, index))}>
            <Trash2 size={14} aria-hidden />
            Убрать вопрос
          </Button>
        </div>
      ))}

      {items.length < 12 ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange([...items, { question: '', answer: '' }])}
        >
          {strings.addQuestion}
        </Button>
      ) : null}
    </fieldset>
  )
}

function replaceAt<T>(items: T[], index: number, next: T): T[] {
  return items.map((item, position) => (position === index ? next : item))
}

function removeAt<T>(items: T[], index: number): T[] {
  return items.filter((_, position) => position !== index)
}
