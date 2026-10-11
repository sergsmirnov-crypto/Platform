import type { PlaybackRequest, PlaybackSource, VideoProvider } from './types'

/**
 * Kinescope.
 *
 * ─────────────────────────────────────────────────────────────────
 * КАК ЗДЕСЬ УСТРОЕНА ЗАЩИТА
 *
 * Не подписанными ссылками, как у файлов, а иначе и лучше: при каждой
 * попытке воспроизведения Kinescope сам обращается к нашему серверу
 * и спрашивает, можно ли этому человеку смотреть этот ролик. Мы отвечаем
 * «да» или «нет», и без «да» ключ расшифровки не выдаётся.
 *
 * Что это даёт по сравнению с подписанной ссылкой:
 *
 *   • проверка происходит в момент просмотра, а не в момент открытия
 *     страницы. Подписка кончилась в среду — видео перестало играть
 *     в среду, а не «когда истечёт выданная ссылка»;
 *   • подсмотренный ключ бесполезен: он проверяется у нас, и мы каждый
 *     раз смотрим текущее состояние подписки;
 *   • это не «ссылку трудно достать», а «файл невозможно проиграть»:
 *     видео зашифровано, и ключ выдаёт сервер лицензий.
 *
 * Наша сторона этого разговора — обработчик `/api/video/authorize`.
 * Адрес, по которому Kinescope должен нас спрашивать, прописывается
 * один раз через их API: `pnpm kinescope:setup`.
 * ─────────────────────────────────────────────────────────────────
 */

const EMBED_BASE = 'https://kinescope.io/embed'

export function createKinescopeProvider(): VideoProvider {
  return {
    name: 'kinescope',
    isEnabled: true,

    buildSource(request: PlaybackRequest): PlaybackSource {
      return {
        url: buildUrl(request),
        watermark: request.watermark,
        chapters: request.chapters,
        startSec: request.startSec,
      }
    },
  }
}

/**
 * Адрес ролика с ключом доступа.
 *
 * Ключ едет параметром `drmauthtoken` — именно его Kinescope пришлёт
 * нам обратно, когда будет спрашивать разрешение. Больше в адресе ничего
 * лишнего: водяной знак и оглавление задаются настройками плеера,
 * а не адресом, поэтому их не подделать правкой строки в браузере.
 */
function buildUrl(request: PlaybackRequest): string {
  const url = new URL(`${EMBED_BASE}/${encodeURIComponent(request.videoId)}`)
  url.searchParams.set('drmauthtoken', request.token)

  return url.toString()
}
