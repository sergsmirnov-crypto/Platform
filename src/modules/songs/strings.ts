/**
 * Тексты интерфейса, связанные с разборами.
 *
 * Лежат рядом с модулем, а не в компонентах: формулировки каталога
 * правятся чаще разметки, и искать их по десятку файлов не должно быть
 * нужно.
 */

import { plural } from '@/shared/utils/plural'

export const songStrings = {
  catalog: {
    title: 'Разборы',
    description: 'Библиотека разборов клуба',
    searchPlaceholder: 'Песня или исполнитель',
    reset: 'Сбросить фильтры',
    found: (total: number) => `Найдено: ${total}`,
    empty: 'По этим условиям ничего не нашлось',
    emptyHint: 'Попробуйте убрать часть фильтров или поискать по названию',
    emptyCatalog: 'Разборов пока нет',
    emptyCatalogHint: 'Первые появятся, как только кураторы перенесут их из Telegram',

    /** Ничего не нашлось именно по поисковому запросу */
    notFound: (query: string) => `По запросу «${query}» ничего не нашлось`,
    notFoundHint: 'Проверьте написание или поищите по исполнителю',
    didYouMean: 'Возможно, вы имели в виду',
  },

  filters: {
    level: 'Уровень',
    tuning: 'Строй',
    genre: 'Жанр',
    technique: 'Техника',
    curator: 'Куратор',
    sort: 'Порядок',
  },

  song: {
    levelSwitch: 'Уровень разбора',
    variantSwitch: 'Вариант разбора',
    structure: 'Структура разбора',
    materials: 'Материалы',
    similar: 'Похожие разборы',
    similarHint: 'Из того же жанра и с теми же приёмами',
    noVideo: 'Видео пока не загружено',
    noVideoHint: 'Куратор загрузит его в ближайшее время',
    noArrangements: 'Разбор ещё готовится',
    noArrangementsHint:
      'Песня уже в библиотеке, но куратор пока не выложил ни одного варианта разбора',
    noSections: 'Части разбора пока не размечены',
    curator: 'Куратор',
    about: 'Что освоишь',
    parts: (count: number) => `${count} ${plural(count, 'часть', 'части', 'частей')}`,
    totalTime: 'Общая длительность',
    estimate: 'Времени на разбор',
    progress: (done: number, total: number) => `Прогресс: ${done} из ${total}`,
    backToCatalog: 'Все разборы',
    /** Части без своего видео проигрываются отрезком общего ролика */
    timecode: (from: string, to: string) => `${from} — ${to}`,
  },

  access: {
    videoLocked: 'Видео доступно по подписке',
    materialsLocked: 'Табы и материалы доступны по подписке',
    lockedHint: 'Структура разбора и описание остаются открытыми — прогресс не потерян',
    renew: 'Продлить подписку',
  },

  properties: {
    tuning: 'Строй',
    capo: 'Каподастр',
    tempo: 'Темп',
    key: 'Тональность',
    capoValue: (fret: number) => (fret > 0 ? `${fret} лад` : 'без каподастра'),
    tempoValue: (bpm: number) => `${bpm} уд/мин`,
  },

  status: {
    draft: 'Черновик',
    scheduled: 'Запланировано',
    archived: 'В архиве',
  },
} as const
