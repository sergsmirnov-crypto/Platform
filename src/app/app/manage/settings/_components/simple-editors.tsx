'use client'

import { Trash2 } from 'lucide-react'
import { useState } from 'react'

import type { TelegramChatLink } from '@/modules/settings/catalog'
import { settingsStrings } from '@/modules/settings/strings'
import { MAX_CHAT_CARDS } from '@/modules/settings/validation'
import { Button, Field, Input } from '@/ui'

import { SettingCard } from './setting-card'

/**
 * Ссылка продления подписки и карточки чатов.
 *
 * Оба редактора простые, поэтому лежат в одном файле: разносить их
 * по разным значило бы дважды повторить одну и ту же обвязку ради
 * трёх полей.
 */

export function RenewUrlEditor({ value }: { value: string }) {
  const [url, setUrl] = useState(value)
  const strings = settingsStrings.renew

  return (
    <SettingCard
      settingKey="subscription.renew_url"
      title={strings.title}
      hint={strings.hint}
      getValue={() => url.trim()}
    >
      <Field label={strings.title} htmlFor="renew-url">
        <Input
          id="renew-url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={strings.placeholder}
          inputMode="url"
        />
      </Field>

      {url.trim() === '' ? <p className="text-content-subtle text-xs">{strings.empty}</p> : null}
    </SettingCard>
  )
}

export function ChatsEditor({ value }: { value: TelegramChatLink[] }) {
  const [chats, setChats] = useState<TelegramChatLink[]>(value)
  const strings = settingsStrings.chats

  function update(index: number, patch: Partial<TelegramChatLink>) {
    setChats((current) =>
      current.map((chat, position) => (position === index ? { ...chat, ...patch } : chat)),
    )
  }

  return (
    <SettingCard
      settingKey="telegram.chats"
      title={strings.title}
      hint={strings.hint}
      getValue={() => chats}
    >
      {chats.length === 0 ? <p className="text-content-subtle text-sm">{strings.empty}</p> : null}

      {chats.map((chat, index) => (
        <div
          // Позиция как ключ: карточки различаются только содержимым,
          // а оно меняется на каждое нажатие клавиши
          key={index}
          className="border-border space-y-3 rounded-md border p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={strings.fields.title} htmlFor={`chat-title-${index}`}>
              <Input
                id={`chat-title-${index}`}
                value={chat.title}
                onChange={(event) => update(index, { title: event.target.value })}
              />
            </Field>

            <Field label={strings.fields.description} htmlFor={`chat-desc-${index}`}>
              <Input
                id={`chat-desc-${index}`}
                value={chat.description}
                onChange={(event) => update(index, { description: event.target.value })}
              />
            </Field>
          </div>

          <Field label={strings.fields.url} htmlFor={`chat-url-${index}`}>
            <Input
              id={`chat-url-${index}`}
              value={chat.url}
              onChange={(event) => update(index, { url: event.target.value })}
              inputMode="url"
            />
          </Field>

          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setChats((current) => current.filter((_, position) => position !== index))
            }
          >
            <Trash2 size={14} aria-hidden />
            {strings.remove}
          </Button>
        </div>
      ))}

      {chats.length < MAX_CHAT_CARDS ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            setChats((current) => [...current, { title: '', description: '', url: '' }])
          }
        >
          {strings.add}
        </Button>
      ) : (
        <p className="text-content-subtle text-xs">{strings.limitReached}</p>
      )}
    </SettingCard>
  )
}
