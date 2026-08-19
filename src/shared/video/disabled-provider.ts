import type { PlaybackRequest, PlaybackSource, VideoProvider } from './types'

/**
 * Видеохостинг не подключён.
 *
 * Нужен, чтобы платформу можно было поднять и посмотреть все экраны,
 * не заводя учётной записи и не платя ни за что. Разработчик, впервые
 * открывший проект, не должен упираться в «сначала зарегистрируйтесь
 * на видеохостинге» — до видео он доберётся через час, а бросить проект
 * может на первой минуте.
 *
 * Возвращает пустой адрес. Страница разбора это видит и показывает
 * ту же честную плашку, что и для ещё не загруженного видео.
 */
export function createDisabledVideoProvider(): VideoProvider {
  return {
    name: 'none',
    isEnabled: false,

    buildSource(request: PlaybackRequest): PlaybackSource {
      return {
        url: '',
        watermark: request.watermark,
        chapters: request.chapters,
        startSec: request.startSec,
      }
    },
  }
}
