import type { NotificationType } from './catalog'

/** Строка ленты, как её видит интерфейс */
export type NotificationRow = {
  id: bigint
  type: string
  title: string
  body: string | null
  actionUrl: string | null
  channels: string[]
  createdAt: Date
  sentAt: Date | null
  readAt: Date | null
}

/** Неотправленное уведомление, ожидающее вечерней сводки */
export type PendingDigestRow = {
  id: bigint
  userId: string
  type: string
  title: string
}

/** Что нужно, чтобы создать уведомление */
export type NotificationInput = {
  type: NotificationType
  title: string
  body?: string | null
  actionUrl?: string | null
}
