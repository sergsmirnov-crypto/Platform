import { ERROR_CODES } from '@/shared/errors'
import type { ActionResult } from '@/shared/result'

/**
 * Отправка файла с показом прогресса.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ СТАРЫЙ XMLHttpRequest, А НЕ FETCH
 *
 * Прогресс отправки — единственное, чего `fetch` до сих пор не умеет:
 * он сообщает о скачивании, но не о загрузке. Для файла на двадцать
 * мегабайт это разница между полосой, которая ползёт, и кнопкой,
 * которая «ничего не делает» пять секунд, — после чего её нажимают
 * второй раз и получают два одинаковых таба.
 *
 * Как только `fetch` научится этому во всех браузерах, файл заменяется
 * целиком, а места вызова не меняются.
 * ─────────────────────────────────────────────────────────────────
 *
 * Файл едет телом запроса, имя — заголовком. Форма `FormData` здесь
 * не нужна: поле ровно одно, а разбор многочастного тела на сервере
 * стоил бы лишней сборки файла в памяти.
 */

export type UploadFileOptions = {
  url: string
  file: File
  /** Доля отправленного, от 0 до 100 */
  onProgress?: (percent: number) => void
}

/** Ответ, когда до сервера не доехали вовсе */
function networkFailure(message: string): ActionResult<never> {
  return { ok: false, code: ERROR_CODES.UPSTREAM_UNAVAILABLE, message }
}

export function uploadFile<T>(options: UploadFileOptions): Promise<ActionResult<T>> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest()

    request.open('POST', options.url)
    request.setRequestHeader('Content-Type', 'application/octet-stream')
    // В заголовках допустима только латиница, а «Соло.pdf» латиницей
    // не является: имя кодируется здесь и раскодируется на сервере
    request.setRequestHeader('x-file-name', encodeURIComponent(options.file.name))

    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return
      options.onProgress?.(Math.round((event.loaded / event.total) * 100))
    })

    request.addEventListener('load', () => {
      try {
        resolve(JSON.parse(request.responseText) as ActionResult<T>)
      } catch {
        // Ответ не разобрался: обычно это страница ошибки от посредника
        // между браузером и приложением, а не наш ответ
        resolve(networkFailure('Сервер ответил непонятно. Попробуйте ещё раз'))
      }
    })

    request.addEventListener('error', () => {
      resolve(networkFailure('Не удалось связаться с сервером'))
    })

    request.addEventListener('abort', () => {
      resolve(networkFailure('Загрузка отменена'))
    })

    request.send(options.file)
  })
}
