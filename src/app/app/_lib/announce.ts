import 'server-only'

import { notificationStrings } from '@/modules/notifications'
import { notifyMany } from '@/modules/notifications/jobs'
import { getNotifiableUserIds } from '@/modules/subscription'
import { routes } from '@/shared/routes'

/**
 * Оповещение клуба о новом содержимом.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЖИВЁТ В СЛОЕ ПРИЛОЖЕНИЯ, А НЕ В МОДУЛЯХ
 *
 * Чтобы сообщить о новом разборе, нужно знать три вещи сразу: что за
 * разбор (разборы), кто сейчас участник (подписки) и как построить
 * уведомление (уведомления). Ни одному из трёх модулей не позволено
 * знать про два других.
 *
 * Свести их может только слой приложения — тот же приём, что у сборки
 * отложенного и заметок.
 * ─────────────────────────────────────────────────────────────────
 *
 * **Ни одна из этих функций не бросает исключений.** Уведомление —
 * следствие публикации, а не её часть: куратор, получивший ошибку после
 * успешной публикации, нажмёт «Опубликовать» ещё раз и получит дубль.
 * Обработку берёт на себя `notifyMany`, которая пишет в журнал и молчит.
 */

/** Новый разбор опубликован */
export async function announceSong(song: {
  title: string
  artist: string
  slug: string
}): Promise<void> {
  const recipients = await getNotifiableUserIds()

  await notifyMany(recipients, {
    type: 'song.published',
    title: notificationStrings.events.songPublished(song.title, song.artist),
    actionUrl: routes.app.learn.song(song.slug),
  })
}

/**
 * Запись эфира выложена.
 *
 * Оповещаем только тогда, когда запись действительно есть: опубликованный
 * анонс — это ещё не повод писать людям, что «запись готова». Проверку
 * делает вызывающий: только он знает, привязано ли видео.
 */
export async function announceStreamRecording(stream: {
  title: string
  slug: string
}): Promise<void> {
  const recipients = await getNotifiableUserIds()

  await notifyMany(recipients, {
    type: 'stream.recorded',
    title: notificationStrings.events.streamRecorded(stream.title),
    actionUrl: routes.app.streams.stream(stream.slug),
  })
}

/**
 * Новость клуба опубликована.
 *
 * Уходит вечерней сводкой вместе с разборами и записями эфиров:
 * объявление о встрече через неделю не требует отдельного сообщения
 * посреди рабочего дня.
 */
export async function announceNews(post: { title: string; slug: string }): Promise<void> {
  const recipients = await getNotifiableUserIds()

  await notifyMany(recipients, {
    type: 'club.news',
    title: notificationStrings.events.newsPublished(post.title),
    actionUrl: routes.app.club.newsPost(post.slug),
  })
}
