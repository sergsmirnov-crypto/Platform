'use client'

import { useEffect, useRef } from 'react'

/**
 * Виджет входа Telegram.
 *
 * Telegram не даёт вставить кнопку разметкой — её создаёт их собственный
 * скрипт, который подставляет на своё место защищённый фрейм. Поэтому здесь
 * клиентский компонент: скрипт добавляется в разметку после появления
 * страницы в браузере.
 *
 * ⚠️ Важное ограничение, о котором стоит помнить при разработке:
 * виджет работает только на домене, привязанном к боту через @BotFather
 * (команда /setdomain). На `localhost` он не появится — там для входа
 * используется служебная страница /dev/login.
 *
 * Режим выбран с перенаправлением (`data-auth-url`), а не с обратным
 * вызовом в браузере: тогда данные попадают сразу на сервер, а не проходят
 * через код страницы, где их было бы легче подменить.
 */

type TelegramLoginWidgetProps = {
  /** Имя бота без символа @ */
  botUsername: string
  /** Полный адрес, куда Telegram вернёт человека после подтверждения */
  authUrl: string
}

export function TelegramLoginWidget({ botUsername, authUrl }: TelegramLoginWidgetProps) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = container.current
    if (!node) return

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '20')
    script.setAttribute('data-userpic', 'false')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-auth-url', authUrl)

    node.appendChild(script)

    // При переходе на другую страницу убираем за собой: иначе при возврате
    // на страницу входа кнопок станет две
    return () => {
      node.replaceChildren()
    }
  }, [botUsername, authUrl])

  return <div ref={container} className="flex min-h-[48px] items-center justify-center" />
}
