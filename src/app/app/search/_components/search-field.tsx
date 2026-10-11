'use client'

import { Search } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { routes } from '@/shared/routes'
import { MAX_QUERY_LENGTH } from '@/shared/search'
import { Button, Input } from '@/ui'

/**
 * Строка поиска.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОИСК ПО НАЖАТИЮ, А НЕ ПРИ КАЖДОЙ БУКВЕ
 *
 * Поиск на лету выглядит современнее и стоит четырёх запросов к базе
 * на каждое слово — по одному на раздел. При двухстах пятидесяти
 * участниках это не нагрузка, но и пользы нет: человек всё равно
 * дочитывает результаты после того, как допечатал.
 *
 * Главное же — адрес. Запрос живёт в адресной строке, поэтому
 * результаты можно открыть в новой вкладке, отправить другому
 * и вернуться к ним кнопкой «назад». Поиск на лету пришлось бы
 * либо не записывать в адрес, либо засорять историю браузера каждой
 * буквой.
 * ─────────────────────────────────────────────────────────────────
 */
export function SearchField() {
  const router = useRouter()
  const params = useSearchParams()

  const [value, setValue] = useState(params.get('q') ?? '')

  function submit(): void {
    const query = value.trim()
    router.push(
      query ? `${routes.app.search()}?q=${encodeURIComponent(query)}` : routes.app.search(),
    )
  }

  return (
    <div className="mb-8 flex gap-2">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
        }}
        maxLength={MAX_QUERY_LENGTH}
        placeholder="Название, исполнитель, тема эфира"
        aria-label="Поиск по платформе"
        autoFocus
      />

      <Button onClick={submit}>
        <Search size={18} aria-hidden />
        <span className="sr-only sm:not-sr-only">Найти</span>
      </Button>
    </div>
  )
}
