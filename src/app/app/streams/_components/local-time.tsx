'use client'

import { useSyncExternalStore } from 'react'

import { formatStreamTime, isSameClockAsClub, streamStrings } from '@/modules/streams'

/**
 * Время эфира в поясе того, кто смотрит.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЕДИНСТВЕННОЕ, ЧТО ЗДЕСЬ ОБЯЗАНО СЧИТАТЬСЯ В БРАУЗЕРЕ
 *
 * Сервер знает пояс клуба и не знает пояса человека: заголовки запроса
 * его не содержат, а гадать по языку — верный способ ошибиться. Поэтому
 * основную строку («20:00 МСК») пишет сервер, а браузер дописывает
 * местное время, если оно отличается.
 *
 * В клубе десяток человек в США, Канаде и Сербии (PRD v0.2 §0).
 * Для них разница между «20:00» и «у вас — 13:00» — это разница между
 * «пришёл на эфир» и «пропустил».
 * ─────────────────────────────────────────────────────────────────
 *
 * **Почему `useSyncExternalStore`, а не состояние с эффектом.**
 * Часовой пояс — это внешнее по отношению к React значение, которого
 * на сервере не существует. Ровно для такого случая эта функция
 * и предназначена: на сервере она отдаёт пустоту, в браузере — реальный
 * пояс, и расхождения между серверной и браузерной разметкой не возникает.
 * Вариант «записать пояс в состояние из эффекта» дал бы лишнюю отрисовку
 * страницы и запрещён правилом линтера.
 */

/** Пояс за время жизни страницы не меняется — подписываться не на что */
const noSubscription = () => () => {}

function readTimeZone(): string | null {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || null
}

/** На сервере пояса человека нет: там строка не показывается вовсе */
const noTimeZone = () => null

export function LocalTime({ startsAt }: { startsAt: Date }) {
  const timeZone = useSyncExternalStore(noSubscription, readTimeZone, noTimeZone)

  if (!timeZone || isSameClockAsClub(startsAt, timeZone)) return null

  return (
    <span className="text-content-subtle">
      · {streamStrings.page.localTime(formatStreamTime(startsAt, timeZone))}
    </span>
  )
}
